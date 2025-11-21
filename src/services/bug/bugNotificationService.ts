/**
 * Bug Report Notification Service
 *
 * Sends notifications when bug reports are created or updated.
 * Uses the existing Resend email service.
 *
 * TODO: Configure notifications:
 * 1. Update BugReportSettings.notifyEmails with admin emails
 * 2. (Optional) Add Slack webhook URL to settings
 * 3. (Optional) Add Discord webhook URL to settings
 */

import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../config/nodemailer";

// Email Templates
const newBugReportTemplate = (report: any) => `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
    <h2 style="color: #d93025;">New Bug Report: ${report.reportNumber}</h2>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <h3 style="margin: 0 0 10px 0;">${report.title}</h3>
      <p style="margin: 0; color: #666;">${report.description.substring(0, 200)}${report.description.length > 200 ? '...' : ''}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>App:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${report.app.displayName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Module:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${report.module.name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Severity:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          <span style="background: ${getSeverityColor(report.severity)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
            ${report.severity}
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Priority:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${report.priority}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Reporter:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${report.reporter.name} (${report.reporter.email})</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;"><strong>Page URL:</strong></td>
        <td style="padding: 8px 0; word-break: break-all;">${report.pageUrl || 'N/A'}</td>
      </tr>
    </table>

    <p style="text-align: center; margin: 20px 0;">
      <a href="${process.env.BASE_URL}/bugs" style="background-color: #1a73e8; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
        View in Dashboard
      </a>
    </p>

    <p style="color: #999; font-size: 12px; text-align: center;">
      This is an automated notification from DeuceLeague Bug Tracking System
    </p>
  </div>
`;

const statusChangeTemplate = (report: any, oldStatus: string, newStatus: string) => `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
    <h2 style="color: #1a73e8;">Bug Report Status Updated</h2>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0 0 10px 0;"><strong>${report.reportNumber}</strong>: ${report.title}</p>
      <p style="margin: 0;">
        Status changed from
        <span style="background: #e0e0e0; padding: 2px 8px; border-radius: 4px;">${oldStatus}</span>
        to
        <span style="background: ${getStatusColor(newStatus)}; color: white; padding: 2px 8px; border-radius: 4px;">${newStatus}</span>
      </p>
    </div>

    ${report.resolutionNotes ? `
    <div style="margin: 15px 0;">
      <strong>Resolution Notes:</strong>
      <p style="background: #f0f7ff; padding: 10px; border-radius: 4px; margin: 5px 0;">${report.resolutionNotes}</p>
    </div>
    ` : ''}

    <p style="text-align: center; margin: 20px 0;">
      <a href="${process.env.BASE_URL}/bugs" style="background-color: #1a73e8; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
        View Details
      </a>
    </p>
  </div>
`;

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#d93025';
    case 'HIGH': return '#ea8600';
    case 'MEDIUM': return '#f9ab00';
    case 'LOW': return '#34a853';
    default: return '#5f6368';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'NEW': return '#1a73e8';
    case 'IN_PROGRESS': return '#ea8600';
    case 'RESOLVED': return '#34a853';
    case 'CLOSED': return '#5f6368';
    default: return '#1a73e8';
  }
}

/**
 * Send notification for new bug report
 */
export async function notifyNewBugReport(bugReportId: string): Promise<void> {
  try {
    const report = await prisma.bugReport.findUnique({
      where: { id: bugReportId },
      include: {
        app: true,
        module: true,
        reporter: true,
      },
    });

    if (!report) return;

    const settings = await prisma.bugReportSettings.findUnique({
      where: { appId: report.appId },
    });

    if (!settings?.notifyOnNew) return;

    // Send email notifications
    const notifyEmails = (settings.notifyEmails || []) as string[];
    if (Array.isArray(notifyEmails) && notifyEmails.length > 0) {
      const subject = `[${report.severity}] New Bug: ${report.reportNumber} - ${report.title}`;
      const html = newBugReportTemplate(report);

      for (const email of notifyEmails) {
        try {
          await sendEmail(email, subject, html);
          console.log(`Sent new bug notification to ${email}`);
        } catch (err) {
          console.error(`Failed to send email to ${email}:`, err);
        }
      }
    }

    // Send Slack notification
    if (settings.slackWebhookUrl) {
      await sendSlackNotification(settings.slackWebhookUrl, {
        text: `New Bug Report: ${report.reportNumber}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: `🐛 ${report.reportNumber}: ${report.title}` }
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Severity:*\n${report.severity}` },
              { type: "mrkdwn", text: `*Module:*\n${report.module.name}` },
              { type: "mrkdwn", text: `*Reporter:*\n${report.reporter.name}` },
              { type: "mrkdwn", text: `*App:*\n${report.app.displayName}` },
            ]
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Description:*\n${report.description.substring(0, 200)}...` }
          }
        ]
      });
    }

    // Send Discord notification
    if (settings.discordWebhookUrl) {
      await sendDiscordNotification(settings.discordWebhookUrl, {
        embeds: [{
          title: `🐛 ${report.reportNumber}: ${report.title}`,
          description: report.description.substring(0, 200),
          color: report.severity === 'CRITICAL' ? 0xd93025 : 0x1a73e8,
          fields: [
            { name: "Severity", value: report.severity, inline: true },
            { name: "Module", value: report.module.name, inline: true },
            { name: "Reporter", value: report.reporter.name || "Unknown", inline: true },
          ],
        }]
      });
    }
  } catch (error) {
    console.error("Failed to send new bug notifications:", error);
  }
}

/**
 * Send notification for status change
 */
export async function notifyStatusChange(
  bugReportId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  try {
    const report = await prisma.bugReport.findUnique({
      where: { id: bugReportId },
      include: {
        app: true,
        module: true,
        reporter: true,
      },
    });

    if (!report) return;

    const settings = await prisma.bugReportSettings.findUnique({
      where: { appId: report.appId },
    });

    if (!settings?.notifyOnStatusChange) return;

    // Notify reporter
    if (report.reporter.email) {
      const subject = `Bug ${report.reportNumber} status updated to ${newStatus}`;
      const html = statusChangeTemplate(report, oldStatus, newStatus);

      try {
        await sendEmail(report.reporter.email, subject, html);
        console.log(`Sent status change notification to reporter ${report.reporter.email}`);
      } catch (err) {
        console.error(`Failed to send email to reporter:`, err);
      }
    }

    // Notify admins for critical status changes
    if (['RESOLVED', 'CLOSED', 'WONT_FIX'].includes(newStatus)) {
      const notifyEmails = (settings.notifyEmails || []) as string[];
      if (Array.isArray(notifyEmails)) {
        for (const email of notifyEmails) {
          try {
            const subject = `Bug ${report.reportNumber} ${newStatus.toLowerCase()}`;
            const html = statusChangeTemplate(report, oldStatus, newStatus);
            await sendEmail(email, subject, html);
          } catch (err) {
            console.error(`Failed to send email to ${email}:`, err);
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to send status change notifications:", error);
  }
}

/**
 * Send Slack webhook notification
 */
async function sendSlackNotification(webhookUrl: string, payload: any): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Slack notification failed:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

/**
 * Send Discord webhook notification
 */
async function sendDiscordNotification(webhookUrl: string, payload: any): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Discord notification failed:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
}
