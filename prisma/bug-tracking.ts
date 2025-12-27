import { BugPriority, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedBugTrackingApps(defaultAssigneeAdminId?: string) {
  // Check if DLA app already exists
  const existingApp = await prisma.app.findUnique({
    where: { code: "DLA" },
    include: { bugSettings: true },
  });

  if (existingApp) {
    // Update settings if they exist but sync is disabled
    if (existingApp.bugSettings && !existingApp.bugSettings.syncEnabled) {
      await prisma.bugReportSettings.update({
        where: { appId: existingApp.id },
        data: {
          googleSheetId: "11CuuMdtBZDtdAJOVvWzNeb6gW39kuLSil1g7skYqjjg",
          googleSheetName: "DeuceLeague",
          syncEnabled: true,
        },
      });
      console.log("   Updated DLA settings with Google Sheets sync enabled");
    } else {
      console.log("   Bug tracking apps already exist, skipping seed...");
    }
    return existingApp;
  }

  // Create DeuceLeague Admin app
  const dlaApp = await prisma.app.create({
    data: {
      code: "DLA",
      name: "deuceleague-admin",
      displayName: "DeuceLeague Admin",
      description: "Admin dashboard for managing DeuceLeague",
      appUrl: "https://admin.deuceleague.com",
      isActive: true,
      bugModules: {
        create: [
          {
            name: "Dashboard",
            code: "DASHBOARD",
            description: "Main dashboard and analytics",
            sortOrder: 1,
          },
          {
            name: "Players",
            code: "PLAYERS",
            description: "Player management",
            sortOrder: 2,
          },
          {
            name: "Leagues",
            code: "LEAGUES",
            description: "League management",
            sortOrder: 3,
          },
          {
            name: "Seasons",
            code: "SEASONS",
            description: "Season management",
            sortOrder: 4,
          },
          {
            name: "Divisions",
            code: "DIVISIONS",
            description: "Division management",
            sortOrder: 5,
          },
          {
            name: "Matches",
            code: "MATCHES",
            description: "Match scheduling and results",
            sortOrder: 6,
          },
          {
            name: "Payments",
            code: "PAYMENTS",
            description: "Payment processing",
            sortOrder: 7,
          },
          {
            name: "Chat",
            code: "CHAT",
            description: "Chat and messaging",
            sortOrder: 8,
          },
          {
            name: "Notifications",
            code: "NOTIFICATIONS",
            description: "Notification system",
            sortOrder: 9,
          },
          {
            name: "Settings",
            code: "SETTINGS",
            description: "App settings",
            sortOrder: 10,
          },
          {
            name: "Authentication",
            code: "AUTH",
            description: "Login, registration, password",
            sortOrder: 11,
          },
          {
            name: "Other",
            code: "OTHER",
            description: "Other issues",
            sortOrder: 99,
          },
        ],
      },
      bugSettings: {
        create: {
          enableScreenshots: true,
          enableAutoCapture: true,
          enableConsoleCapture: true,
          enableNetworkCapture: false,
          maxScreenshots: 5,
          maxFileSize: 5242880, // 5MB
          notifyOnNew: true,
          notifyOnStatusChange: true,
          defaultPriority: BugPriority.NORMAL,
          notifyEmails: [], // Add admin emails to notify
          googleSheetId: "11CuuMdtBZDtdAJOVvWzNeb6gW39kuLSil1g7skYqjjg",
          googleSheetName: "DeuceLeague",
          syncEnabled: true,
          ...(defaultAssigneeAdminId && {
            defaultAssigneeId: defaultAssigneeAdminId,
          }),
        },
      },
    },
    include: {
      bugModules: true,
      bugSettings: true,
    },
  });

  // Create DeuceLeague Mobile app
  const dlmApp = await prisma.app.create({
    data: {
      code: "DLM",
      name: "deuceleague-mobile",
      displayName: "DeuceLeague Mobile",
      description: "Mobile app for players",
      isActive: true,
      bugModules: {
        create: [
          {
            name: "Home",
            code: "HOME",
            description: "Home screen",
            sortOrder: 1,
          },
          {
            name: "Profile",
            code: "PROFILE",
            description: "User profile",
            sortOrder: 2,
          },
          {
            name: "Matches",
            code: "MATCHES",
            description: "Match viewing and scheduling",
            sortOrder: 3,
          },
          {
            name: "Pairing",
            code: "PAIRING",
            description: "Partner pairing system",
            sortOrder: 4,
          },
          {
            name: "Leaderboard",
            code: "LEADERBOARD",
            description: "Rankings and standings",
            sortOrder: 5,
          },
          {
            name: "Chat",
            code: "CHAT",
            description: "In-app messaging",
            sortOrder: 6,
          },
          {
            name: "Notifications",
            code: "NOTIFICATIONS",
            description: "Push notifications",
            sortOrder: 7,
          },
          {
            name: "Registration",
            code: "REGISTRATION",
            description: "Season registration",
            sortOrder: 8,
          },
          {
            name: "Authentication",
            code: "AUTH",
            description: "Login, signup, password",
            sortOrder: 9,
          },
          {
            name: "Other",
            code: "OTHER",
            description: "Other issues",
            sortOrder: 99,
          },
        ],
      },
      bugSettings: {
        create: {
          enableScreenshots: true,
          enableAutoCapture: true,
          enableConsoleCapture: false,
          enableNetworkCapture: false,
          maxScreenshots: 3,
          maxFileSize: 5242880,
          notifyOnNew: true,
          notifyOnStatusChange: true,
          defaultPriority: BugPriority.NORMAL,
          notifyEmails: [],
          googleSheetId: "",
          googleSheetName: "Bug Reports - Mobile",
          syncEnabled: false,
          ...(defaultAssigneeAdminId && {
            defaultAssigneeId: defaultAssigneeAdminId,
          }),
        },
      },
    },
    include: {
      bugModules: true,
    },
  });

  console.log(`   Created ${dlaApp.bugModules.length} modules for DLA`);
  console.log(`   Created ${dlmApp.bugModules.length} modules for DLM`);

  return dlaApp;
}

async function main() {
  try {
    await seedBugTrackingApps();
  } catch (error) {
    console.log("Error seeding bug tracking feature", error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
