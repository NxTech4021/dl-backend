/**
 * Bug Reports Seeding
 * Creates apps, modules, and bug reports
 */

import {
  User,
  BugReportType,
  BugSeverity,
  BugPriority,
  BugStatus,
} from "@prisma/client";
import {
  prisma,
  randomDate,
  randomElement,
  randomInt,
  randomBoolean,
  monthsAgo,
  daysAgo,
  logSection,
  logSuccess,
  logProgress,
} from "./utils";
import type { SeededAdmin } from "./users.seed";

// =============================================
// TYPES
// =============================================

export interface SeededBugData {
  bugCount: number;
}

// =============================================
// BUG REPORT DATA
// =============================================

const BUG_TITLES = [
  "Button alignment issue on mobile",
  "Dark mode colors not applying correctly",
  "Modal doesn't close on backdrop click",
  "Text overflow in player name display",
  "Loading spinner stuck on screen",
  "Navigation menu not responsive",
  "Chart tooltips cut off on edge",
  "Form input placeholder hard to read",
  "Profile image not displaying correctly",
  "Sidebar collapse animation glitchy",
  "Match result not saving",
  "Unable to submit score",
  "Filter not working on matches list",
  "Search returns no results for valid query",
  "Notification not received for match",
  "Rating not updating after match",
  "Cannot change partner in team",
  "Export to CSV produces empty file",
  "Duplicate entries created on submit",
  "Sort order resets after page refresh",
  "App freezes when loading large list",
  "Slow response time on dashboard",
  "Image loading very slow",
  "Scrolling laggy on match history",
  "Search takes too long to respond",
  "Session not expiring properly",
  "Incorrect win/loss count",
  "Rating calculation seems wrong",
  "Duplicate match entries in history",
  "Missing matches from standings",
];

const BUG_DESCRIPTIONS = [
  "When I try to perform this action, the expected behavior doesn't occur. I've tried multiple times on different devices.",
  "This issue started happening after the last update. It was working fine before.",
  "The problem occurs intermittently, maybe 50% of the time. Hard to reproduce consistently.",
  "I've attached screenshots showing the issue. Multiple users have reported the same problem.",
  "This is blocking me from completing my match registration. Please prioritize.",
  "Steps to reproduce: 1) Open the app 2) Navigate to the feature 3) Try to use it 4) Observe the error",
  "The error message shown is not helpful. Would be good to have more descriptive errors.",
  "This works on web but not on mobile app. Testing on iPhone 14 with latest iOS.",
  "Clearing cache and reinstalling didn't help. The issue persists.",
  "This is a regression - it was working in the previous version but broke recently.",
  "The UI shows success but the data isn't actually saved. Very confusing for users.",
  "This happens every time without fail. 100% reproducible on my end.",
  "Expected: Feature should work as documented. Actual: Feature throws an error.",
  "Console shows network error 500 when this happens. Server logs might have more info.",
  "Multiple team members have verified this issue. Not isolated to one account.",
];

const RESOLUTION_NOTES = [
  "Fixed by updating the component logic",
  "Resolved - was a caching issue",
  "Applied database migration to fix data inconsistency",
  "Fixed in latest release",
  "Configuration change applied",
  "Deployed hotfix to production",
  "Root cause identified and patched",
  "API endpoint corrected",
];

// =============================================
// SEED APPS AND MODULES
// =============================================

export async function seedAppsAndModules(): Promise<{ appId: string; moduleIds: string[] }> {
  logSection("📱 Seeding apps and modules...");

  // Check if app already exists
  let app = await prisma.app.findUnique({
    where: { code: "dl-mobile" },
  });

  if (!app) {
    app = await prisma.app.create({
      data: {
        code: "dl-mobile",
        name: "DL Mobile",
        displayName: "DeuceLeague Mobile App",
        description: "Mobile application for DeuceLeague",
        isActive: true,
      },
    });
    logProgress("   Created DL Mobile app");
  }

  // Check for admin app
  let adminApp = await prisma.app.findUnique({
    where: { code: "dl-admin" },
  });

  if (!adminApp) {
    adminApp = await prisma.app.create({
      data: {
        code: "dl-admin",
        name: "DL Admin",
        displayName: "DeuceLeague Admin Dashboard",
        description: "Admin dashboard for DeuceLeague",
        isActive: true,
      },
    });
    logProgress("   Created DL Admin app");
  }

  // Create modules for mobile app
  const moduleData = [
    { code: "auth", name: "Authentication", description: "Login, registration, password reset" },
    { code: "matches", name: "Matches", description: "Match scheduling, results, history" },
    { code: "ratings", name: "Ratings", description: "Player ratings and rankings" },
    { code: "seasons", name: "Seasons", description: "Season management and registration" },
    { code: "profile", name: "Profile", description: "User profile and settings" },
    { code: "chat", name: "Chat", description: "Messaging and notifications" },
    { code: "dashboard", name: "Dashboard", description: "Home dashboard and overview" },
    { code: "teams", name: "Teams", description: "Team management and partnerships" },
  ];

  const moduleIds: string[] = [];

  for (const mod of moduleData) {
    let module = await prisma.bugModule.findFirst({
      where: { appId: app.id, code: mod.code },
    });

    if (!module) {
      module = await prisma.bugModule.create({
        data: {
          appId: app.id,
          code: mod.code,
          name: mod.name,
          description: mod.description,
          isActive: true,
        },
      });
    }
    moduleIds.push(module.id);
  }

  logSuccess(`Created/verified app with ${moduleIds.length} modules`);
  return { appId: app.id, moduleIds };
}

// =============================================
// SEED BUG REPORTS
// =============================================

export async function seedBugReports(users: User[], admins: SeededAdmin[], appId: string, moduleIds: string[]): Promise<number> {
  logSection("🐛 Seeding bug reports...");

  const activeUsers = users.filter(u => u.status === "ACTIVE" && u.completedOnboarding);
  let created = 0;
  const targetBugs = 60;

  // Status distribution
  const statusDistribution: { status: BugStatus; weight: number }[] = [
    { status: BugStatus.RESOLVED, weight: 30 },
    { status: BugStatus.CLOSED, weight: 15 },
    { status: BugStatus.NEW, weight: 20 },
    { status: BugStatus.IN_PROGRESS, weight: 15 },
    { status: BugStatus.TRIAGED, weight: 10 },
    { status: BugStatus.WONT_FIX, weight: 5 },
    { status: BugStatus.DUPLICATE, weight: 5 },
  ];

  // Severity distribution
  const severityDistribution: { severity: BugSeverity; weight: number }[] = [
    { severity: BugSeverity.MEDIUM, weight: 40 },
    { severity: BugSeverity.LOW, weight: 30 },
    { severity: BugSeverity.HIGH, weight: 20 },
    { severity: BugSeverity.CRITICAL, weight: 10 },
  ];

  // Priority distribution
  const priorityDistribution: { priority: BugPriority; weight: number }[] = [
    { priority: BugPriority.NORMAL, weight: 50 },
    { priority: BugPriority.LOW, weight: 25 },
    { priority: BugPriority.HIGH, weight: 20 },
    { priority: BugPriority.URGENT, weight: 5 },
  ];

  const totalStatusWeight = statusDistribution.reduce((sum, s) => sum + s.weight, 0);
  const totalSeverityWeight = severityDistribution.reduce((sum, s) => sum + s.weight, 0);
  const totalPriorityWeight = priorityDistribution.reduce((sum, p) => sum + p.weight, 0);

  for (let i = 0; i < targetBugs; i++) {
    const reporter = randomElement(activeUsers);

    // Select status
    let random = Math.random() * totalStatusWeight;
    let selectedStatus = statusDistribution[0].status;
    for (const { status, weight } of statusDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedStatus = status;
        break;
      }
    }

    // Select severity
    random = Math.random() * totalSeverityWeight;
    let selectedSeverity = severityDistribution[0].severity;
    for (const { severity, weight } of severityDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedSeverity = severity;
        break;
      }
    }

    // Select priority
    random = Math.random() * totalPriorityWeight;
    let selectedPriority = priorityDistribution[0].priority;
    for (const { priority, weight } of priorityDistribution) {
      random -= weight;
      if (random <= 0) {
        selectedPriority = priority;
        break;
      }
    }

    const createdAt = randomDate(monthsAgo(8), daysAgo(1));
    const isResolved = selectedStatus === BugStatus.RESOLVED || selectedStatus === BugStatus.CLOSED;
    const admin = admins.length > 0 ? randomElement(admins) : null;

    // Generate report number
    const reportNumber = `BUG-${Date.now()}-${i.toString().padStart(4, "0")}`;

    await prisma.bugReport.create({
      data: {
        reportNumber,
        title: randomElement(BUG_TITLES),
        description: randomElement(BUG_DESCRIPTIONS),
        moduleId: randomElement(moduleIds),
        appId,
        reportType: randomElement([BugReportType.BUG, BugReportType.BUG, BugReportType.FEEDBACK, BugReportType.IMPROVEMENT]),
        severity: selectedSeverity,
        priority: selectedPriority,
        status: selectedStatus,
        stepsToReproduce: randomBoolean(0.6) ? "1. Open app\n2. Navigate to feature\n3. Perform action\n4. Observe issue" : null,
        expectedBehavior: randomBoolean(0.5) ? "Feature should work correctly" : null,
        actualBehavior: randomBoolean(0.5) ? "Feature shows error or unexpected behavior" : null,
        reporterId: reporter.id,
        assignedToId: selectedStatus === BugStatus.IN_PROGRESS && admin ? admin.adminId : null,
        resolvedById: isResolved && admin ? admin.adminId : null,
        resolvedAt: isResolved ? randomDate(createdAt, new Date()) : null,
        resolutionNotes: isResolved ? randomElement(RESOLUTION_NOTES) : null,
        userAgent: randomElement([
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
          "Mozilla/5.0 (Linux; Android 14)",
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17",
          null,
        ]),
        browserName: randomElement(["Safari", "Chrome", "Firefox", null]),
        osName: randomElement(["iOS", "Android", "Windows", "macOS", null]),
        appVersion: randomElement(["2.3.0", "2.3.1", "2.4.0", "2.4.1", null]),
        viewCount: randomInt(0, 50),
        createdAt,
        updatedAt: randomDate(createdAt, new Date()),
      },
    });
    created++;

    if (created % 15 === 0) {
      logProgress(`   Bug reports: ${created}/${targetBugs}`);
    }
  }

  logSuccess(`Created ${created} bug reports`);
  return created;
}

// =============================================
// MAIN BUG SEEDING FUNCTION
// =============================================

export async function seedBugsAndFeedback(users: User[], admins: SeededAdmin[]): Promise<SeededBugData> {
  const { appId, moduleIds } = await seedAppsAndModules();
  const bugCount = await seedBugReports(users, admins, appId, moduleIds);

  return {
    bugCount,
  };
}
