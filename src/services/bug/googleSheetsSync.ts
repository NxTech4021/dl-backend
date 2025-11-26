/**
 * Google Sheets Sync Service for Bug Reports
 *
 * TODO: Setup Instructions
 * 1. Go to Google Cloud Console: https://console.cloud.google.com
 * 2. Create a new project or select existing
 * 3. Enable Google Sheets API
 * 4. Create a Service Account with Editor role
 * 5. Download JSON key file and save as src/config/google-sheets-key.json
 * 6. Share your Google Sheet with the service account email
 * 7. Add environment variables (see below)
 *
 * Environment Variables needed:
 * - GOOGLE_SHEETS_KEY_FILE=src/config/google-sheets-key.json
 *
 * Then update BugReportSettings for each app with:
 * - googleSheetId: The ID from the sheet URL (between /d/ and /edit)
 * - googleSheetName: The tab name in the sheet
 * - syncEnabled: true
 */

import { google } from "googleapis";
import { prisma } from "../../lib/prisma";
import path from "path";
import fs from "fs";

// Types
interface BugReportRow {
  reportNumber: string;
  title: string;
  description: string;
  module: string;
  status: string;
  severity: string;
  priority: string;
  reportType: string;
  reporter: string;
  reporterEmail: string;
  assignedTo: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  pageUrl: string;
  browser: string;
  os: string;
  createdAt: string;
  resolvedAt: string;
  resolutionNotes: string;
}

// Initialize Google Sheets client
let sheetsClient: any = null;

async function getGoogleSheetsClient() {
  if (sheetsClient) return sheetsClient;

  // TODO: Update this path to your actual key file location
  const keyFilePath = process.env.GOOGLE_SHEETS_KEY_FILE ||
    path.join(__dirname, "../../config/google-sheets-key.json");

  if (!fs.existsSync(keyFilePath)) {
    console.warn(`Google Sheets key file not found at: ${keyFilePath}`);
    console.warn("Google Sheets sync is disabled. See googleSheetsSync.ts for setup instructions.");
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

/**
 * Sync a bug report to Google Sheets
 */
export async function syncBugReportToSheet(bugReportId: string): Promise<boolean> {
  try {
    const sheets = await getGoogleSheetsClient();
    if (!sheets) return false;

    // Get bug report with all relations
    const bugReport = await prisma.bugReport.findUnique({
      where: { id: bugReportId },
      include: {
        app: true,
        module: true,
        reporter: true,
        assignedTo: { include: { user: true } },
      },
    });

    if (!bugReport) {
      console.error(`Bug report ${bugReportId} not found`);
      return false;
    }

    // Get app settings for sheet info
    const settings = await prisma.bugReportSettings.findUnique({
      where: { appId: bugReport.appId },
    });

    if (!settings?.syncEnabled || !settings?.googleSheetId) {
      console.log(`Sync disabled for app ${bugReport.app.code}`);
      return false;
    }

    const sheetId = settings.googleSheetId;
    const sheetName = settings.googleSheetName || "Bug Reports";

    // Prepare row data
    const rowData: BugReportRow = {
      reportNumber: bugReport.reportNumber,
      title: bugReport.title,
      description: bugReport.description,
      module: bugReport.module.name,
      status: bugReport.status,
      severity: bugReport.severity,
      priority: bugReport.priority,
      reportType: bugReport.reportType,
      reporter: bugReport.reporter.name || "",
      reporterEmail: bugReport.reporter.email || "",
      assignedTo: bugReport.assignedTo?.user?.name || "",
      stepsToReproduce: bugReport.stepsToReproduce || "",
      expectedBehavior: bugReport.expectedBehavior || "",
      actualBehavior: bugReport.actualBehavior || "",
      pageUrl: bugReport.pageUrl || "",
      browser: `${bugReport.browserName || ""} ${bugReport.browserVersion || ""}`.trim(),
      os: `${bugReport.osName || ""} ${bugReport.osVersion || ""}`.trim(),
      createdAt: bugReport.createdAt.toISOString(),
      resolvedAt: bugReport.resolvedAt?.toISOString() || "",
      resolutionNotes: bugReport.resolutionNotes || "",
    };

    const values = [Object.values(rowData)];

    // Check if row exists (by reportNumber)
    if (bugReport.sheetRowId) {
      // Update existing row (A to T = 20 columns)
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${bugReport.sheetRowId}:T${bugReport.sheetRowId}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
    } else {
      // Append new row (A to T = 20 columns)
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:T`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });

      // Extract row number from response
      const updatedRange = response.data.updates?.updatedRange;
      const rowMatch = updatedRange?.match(/!A(\d+):/);
      const rowId = rowMatch ? rowMatch[1] : null;

      // Update bug report with sheet row ID
      if (rowId) {
        await prisma.bugReport.update({
          where: { id: bugReportId },
          data: {
            sheetRowId: rowId,
            sheetSyncedAt: new Date(),
          },
        });
      }
    }

    // Update sync timestamp
    await prisma.bugReport.update({
      where: { id: bugReportId },
      data: { sheetSyncedAt: new Date() },
    });

    console.log(`Synced bug report ${bugReport.reportNumber} to Google Sheets`);
    return true;
  } catch (error) {
    console.error("Google Sheets sync error:", error);
    return false;
  }
}

/**
 * Initialize sheet with headers if empty
 */
export async function initializeSheet(appId: string): Promise<boolean> {
  try {
    const sheets = await getGoogleSheetsClient();
    if (!sheets) return false;

    const settings = await prisma.bugReportSettings.findUnique({
      where: { appId },
    });

    if (!settings?.googleSheetId) return false;

    const sheetId = settings.googleSheetId;
    const sheetName = settings.googleSheetName || "Bug Reports";

    // Check if sheet has headers
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1:T1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      // Add headers (20 columns total)
      const headers = [
        "Report #",
        "Title",
        "Description",
        "Module",
        "Status",
        "Severity",
        "Priority",
        "Type",
        "Reporter",
        "Reporter Email",
        "Assigned To",
        "Steps to Reproduce",
        "Expected Behavior",
        "Actual Behavior",
        "Page URL",
        "Browser",
        "OS",
        "Created At",
        "Resolved At",
        "Resolution Notes",
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1:T1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [headers] },
      });

      console.log(`Initialized sheet headers for ${sheetName}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to initialize sheet:", error);
    return false;
  }
}

/**
 * Bulk sync all bug reports for an app
 */
export async function bulkSyncBugReports(appId: string): Promise<number> {
  const reports = await prisma.bugReport.findMany({
    where: { appId },
    select: { id: true },
  });

  let synced = 0;
  for (const report of reports) {
    const success = await syncBugReportToSheet(report.id);
    if (success) synced++;
  }

  return synced;
}
