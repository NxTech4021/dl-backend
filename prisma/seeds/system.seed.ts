/**
 * System Seed
 * Creates SystemMaintenance and FeatureAnnouncement records.
 */

import {
  prisma,
  randomDate,
  randomElement,
  randomBoolean,
  randomInt,
  monthsAgo,
  daysAgo,
  daysFromNow,
  logSection,
  logSuccess,
} from "./utils";

// =============================================
// SEED SYSTEM MAINTENANCE
// =============================================

async function seedSystemMaintenance(): Promise<number> {
  logSection("🔧 Seeding system maintenance records...");

  const records = [
    // Completed
    {
      title: "Database Migration v2.3",
      description: "Migrating database schema to support new rating system features and performance improvements.",
      status: "COMPLETED" as const,
      startDateTime: monthsAgo(3),
      durationHours: 2,
      affectedServices: ["api", "web", "mobile"],
      notificationSent: true,
      completionSent: true,
    },
    {
      title: "SSL Certificate Renewal",
      description: "Renewing SSL certificates for all production domains.",
      status: "COMPLETED" as const,
      startDateTime: monthsAgo(6),
      durationHours: 1,
      affectedServices: ["api", "web"],
      notificationSent: true,
      completionSent: true,
    },
    // Scheduled
    {
      title: "Server Infrastructure Upgrade",
      description: "Upgrading server infrastructure to improve performance and reliability.",
      status: "SCHEDULED" as const,
      startDateTime: daysFromNow(14),
      durationHours: 4,
      affectedServices: ["api", "web", "mobile", "database"],
      notificationSent: true,
      completionSent: false,
    },
    {
      title: "CDN Migration",
      description: "Migrating static assets to new CDN provider for faster load times.",
      status: "SCHEDULED" as const,
      startDateTime: daysFromNow(30),
      durationHours: 2,
      affectedServices: ["web", "mobile"],
      notificationSent: false,
      completionSent: false,
    },
    // In progress
    {
      title: "Performance Optimization",
      description: "Optimizing database queries and API response times for better user experience.",
      status: "IN_PROGRESS" as const,
      startDateTime: new Date(Date.now() - 30 * 60 * 1000), // started 30 min ago
      durationHours: 3,
      affectedServices: ["api", "database"],
      notificationSent: true,
      completionSent: false,
    },
    {
      title: "Search Index Rebuild",
      description: "Rebuilding search indexes for improved player and match search functionality.",
      status: "IN_PROGRESS" as const,
      startDateTime: new Date(Date.now() - 60 * 60 * 1000), // started 1 hour ago
      durationHours: 2,
      affectedServices: ["api"],
      notificationSent: true,
      completionSent: false,
    },
    // Cancelled
    {
      title: "Planned Network Upgrade",
      description: "Network infrastructure upgrade postponed to next quarter.",
      status: "CANCELLED" as const,
      startDateTime: daysAgo(7),
      durationHours: 4,
      affectedServices: ["api", "web", "mobile"],
      notificationSent: true,
      completionSent: false,
    },
    // Another completed
    {
      title: "Security Patch Deployment",
      description: "Deploying critical security patches to all services.",
      status: "COMPLETED" as const,
      startDateTime: monthsAgo(1),
      durationHours: 1,
      affectedServices: ["api", "web", "mobile"],
      notificationSent: true,
      completionSent: true,
    },
  ];

  let created = 0;

  for (const record of records) {
    const endDateTime = new Date(
      record.startDateTime.getTime() + record.durationHours * 60 * 60 * 1000
    );

    await prisma.systemMaintenance.create({
      data: {
        title: record.title,
        description: record.description,
        startDateTime: record.startDateTime,
        endDateTime,
        status: record.status,
        affectedServices: record.affectedServices,
        notificationSent: record.notificationSent,
        completionSent: record.completionSent,
      },
    });
    created++;
  }

  logSuccess(`Created ${created} system maintenance records`);
  return created;
}

// =============================================
// SEED FEATURE ANNOUNCEMENTS
// =============================================

async function seedFeatureAnnouncements(): Promise<number> {
  logSection("📢 Seeding feature announcements...");

  const announcements = [
    // Published
    {
      title: "New Match Scheduling System",
      description: "We've completely redesigned the match scheduling experience. You can now schedule matches with just a few taps, set preferred times, and get automatic conflict detection.",
      status: "PUBLISHED" as const,
      targetAudience: ["ALL"],
      releaseDate: monthsAgo(4),
      notificationSent: true,
      featureDetails: { highlights: ["Quick scheduling", "Conflict detection", "Calendar integration"] },
    },
    {
      title: "Rating System Update (Glicko-2)",
      description: "Our rating system has been upgraded to use the Glicko-2 algorithm for more accurate and fair player ratings. Your ratings may show slight adjustments.",
      status: "PUBLISHED" as const,
      targetAudience: ["ALL"],
      releaseDate: monthsAgo(3),
      notificationSent: true,
      featureDetails: { highlights: ["More accurate ratings", "Rating deviation tracking", "Provisional player handling"] },
    },
    {
      title: "Dark Mode Available",
      description: "You asked for it, and we delivered! Dark mode is now available in the app settings. Easier on the eyes for late-night match scheduling.",
      status: "PUBLISHED" as const,
      targetAudience: ["ALL"],
      releaseDate: monthsAgo(2),
      notificationSent: true,
      featureDetails: { highlights: ["Full dark theme", "Auto-detect system theme", "Custom accent colors"] },
    },
    {
      title: "Admin Dashboard Redesign",
      description: "The admin dashboard has been completely redesigned with improved navigation, better data visualization, and faster load times.",
      status: "PUBLISHED" as const,
      targetAudience: ["ADMIN"],
      releaseDate: monthsAgo(1),
      notificationSent: true,
      featureDetails: { highlights: ["New navigation", "Better charts", "Faster performance"] },
    },
    {
      title: "Achievement System Launch",
      description: "Earn achievements as you play! Track your progress across matches, seasons, and more. Bronze, Silver, and Gold tiers available.",
      status: "PUBLISHED" as const,
      targetAudience: ["ALL"],
      releaseDate: daysAgo(14),
      notificationSent: true,
      featureDetails: { highlights: ["30 achievements", "3 tier levels", "Progress tracking"] },
    },
    // Draft
    {
      title: "Tournament Brackets",
      description: "End-of-season tournament brackets are coming! Automatic seeding from standings, single and double elimination formats.",
      status: "DRAFT" as const,
      targetAudience: ["ALL"],
      releaseDate: null,
      notificationSent: false,
      featureDetails: { highlights: ["Auto-seeding", "Multiple formats", "Live bracket updates"] },
    },
    {
      title: "In-App Video Chat",
      description: "Schedule video calls with your match opponents to coordinate logistics or discuss match details.",
      status: "DRAFT" as const,
      targetAudience: ["USER"],
      releaseDate: null,
      notificationSent: false,
      featureDetails: { highlights: ["1-on-1 video", "Group calls", "Screen sharing"] },
    },
    {
      title: "Advanced Analytics Dashboard",
      description: "Deep-dive into your performance with advanced analytics including win streaks, opponent analysis, and improvement tracking.",
      status: "DRAFT" as const,
      targetAudience: ["ALL"],
      releaseDate: null,
      notificationSent: false,
      featureDetails: { highlights: ["Performance trends", "Opponent analysis", "Improvement areas"] },
    },
    // Archived
    {
      title: "Beta Testing Program",
      description: "Our beta testing program has concluded. Thank you to all participants for your valuable feedback!",
      status: "ARCHIVED" as const,
      targetAudience: ["ALL"],
      releaseDate: monthsAgo(8),
      notificationSent: true,
      featureDetails: { highlights: ["Testing complete", "Feedback implemented"] },
    },
    {
      title: "Legacy Score System Sunset",
      description: "The old scoring system has been fully replaced by the new Best-6 system. This announcement is now archived.",
      status: "ARCHIVED" as const,
      targetAudience: ["ALL"],
      releaseDate: monthsAgo(6),
      notificationSent: true,
      featureDetails: { highlights: ["Migration complete", "New system active"] },
    },
  ];

  let created = 0;

  for (const announcement of announcements) {
    const announcementDate = announcement.releaseDate || new Date();

    await prisma.featureAnnouncement.create({
      data: {
        title: announcement.title,
        description: announcement.description,
        featureDetails: announcement.featureDetails,
        releaseDate: announcement.releaseDate,
        announcementDate,
        status: announcement.status,
        targetAudience: announcement.targetAudience,
        notificationSent: announcement.notificationSent,
      },
    });
    created++;
  }

  logSuccess(`Created ${created} feature announcements`);
  return created;
}

// =============================================
// MAIN EXPORT
// =============================================

export async function seedSystemData(): Promise<{
  maintenanceCount: number;
  announcementCount: number;
}> {
  const maintenanceCount = await seedSystemMaintenance();
  const announcementCount = await seedFeatureAnnouncements();

  return { maintenanceCount, announcementCount };
}
