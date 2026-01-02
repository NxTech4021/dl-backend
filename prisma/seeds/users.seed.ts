/**
 * User and Admin Seeding
 * Creates 500 users and 10 admins with varied statuses and creation dates
 */

import {
  Role,
  UserStatus,
  AdminStatus,
  User,
  GenderType,
} from "@prisma/client";
import {
  prisma,
  randomDate,
  randomElement,
  randomInt,
  monthsAgo,
  daysAgo,
  MALAYSIAN_FIRST_NAMES,
  MALAYSIAN_LAST_NAMES,
  AREAS,
  BIOS,
  logSection,
  logSuccess,
  logProgress,
} from "./utils";

// =============================================
// TYPES
// =============================================

export interface SeededAdmin {
  userId: string;
  adminId: string;
}

// =============================================
// SEED ADMINS
// =============================================

export async function seedAdmins(): Promise<SeededAdmin[]> {
  logSection("👤 Seeding admin users...");

  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword("Admin@123");

  const adminData = [
    // Active superadmins
    {
      name: "Super Admin",
      email: "superadmin@dleague.com",
      username: "superadmin",
      role: Role.SUPERADMIN,
      status: AdminStatus.ACTIVE,
    },
    {
      name: "Head Admin",
      email: "headadmin@dleague.com",
      username: "headadmin",
      role: Role.SUPERADMIN,
      status: AdminStatus.ACTIVE,
    },

    // Active admins
    {
      name: "Admin User",
      email: "admin@dleague.com",
      username: "admin",
      role: Role.ADMIN,
      status: AdminStatus.ACTIVE,
    },
    {
      name: "Admin Manager",
      email: "manager@dleague.com",
      username: "manager",
      role: Role.ADMIN,
      status: AdminStatus.ACTIVE,
    },
    {
      name: "Operations Admin",
      email: "ops@dleague.com",
      username: "ops_admin",
      role: Role.ADMIN,
      status: AdminStatus.ACTIVE,
    },
    {
      name: "Support Admin",
      email: "support@dleague.com",
      username: "support_admin",
      role: Role.ADMIN,
      status: AdminStatus.ACTIVE,
    },
    {
      name: "League Admin",
      email: "league_admin@dleague.com",
      username: "league_admin",
      role: Role.ADMIN,
      status: AdminStatus.ACTIVE,
    },

    // Various statuses
    {
      name: "Pending Admin",
      email: "pending_admin@dleague.com",
      username: "pending_admin",
      role: Role.ADMIN,
      status: AdminStatus.PENDING,
    },
    {
      name: "Suspended Admin",
      email: "suspended_admin@dleague.com",
      username: "suspended_admin",
      role: Role.ADMIN,
      status: AdminStatus.SUSPENDED,
    },
    {
      name: "New Admin",
      email: "new_admin@dleague.com",
      username: "new_admin",
      role: Role.ADMIN,
      status: AdminStatus.PENDING,
    },
  ];

  const createdAdmins: SeededAdmin[] = [];

  for (const admin of adminData) {
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email },
      include: { admin: true },
    });

    if (existingUser) {
      if (existingUser.admin) {
        createdAdmins.push({
          userId: existingUser.id,
          adminId: existingUser.admin.id,
        });
      }
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: admin.name,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        emailVerified: true,
        completedOnboarding: true,
        status: UserStatus.ACTIVE,
        createdAt: randomDate(monthsAgo(12), monthsAgo(6)),
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    const adminRecord = await prisma.admin.create({
      data: {
        userId: user.id,
        status: admin.status,
      },
    });

    createdAdmins.push({ userId: user.id, adminId: adminRecord.id });
  }

  logSuccess(`Created ${createdAdmins.length} admins`);
  logProgress("- superadmin@dleague.com / Admin@123 (SUPERADMIN)");
  logProgress("- admin@dleague.com / Admin@123 (ACTIVE)");

  return createdAdmins;
}

// =============================================
// SEED USERS
// =============================================

export async function seedUsers(): Promise<User[]> {
  logSection("👥 Seeding test users...");

  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword("Test@123");

  const createdUsers: User[] = [];

  // Configuration for user distribution
  const userConfig = {
    activeComplete: 400, // Active users with complete profiles
    activeIncomplete: 50, // Active users with incomplete onboarding
    inactive: 30, // Inactive users
    suspended: 20, // Suspended users
  };

  const totalUsers = Object.values(userConfig).reduce((a, b) => a + b, 0);
  let userIndex = 0;

  // Helper to create a user
  async function createUser(config: {
    status: UserStatus;
    completedOnboarding: boolean;
    createdAtRange: [Date, Date];
    bioPool?: string[];
  }): Promise<User | null> {
    const isMale = userIndex % 2 === 0;
    const firstName = randomElement(
      isMale ? MALAYSIAN_FIRST_NAMES.male : MALAYSIAN_FIRST_NAMES.female
    );
    const lastName = randomElement(MALAYSIAN_LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const username = `${firstName.toLowerCase()}_${lastName
      .toLowerCase()
      .slice(0, 3)}${userIndex}`;
    const email = `${username}@test.com`;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      userIndex++;
      return existingUser;
    }

    const createdAt = randomDate(
      config.createdAtRange[0],
      config.createdAtRange[1]
    );

    // Generate birth date between 1970 and 2005
    const birthYear = 1970 + randomInt(0, 35);
    const birthMonth = randomInt(0, 11);
    const birthDay = randomInt(1, 28);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        bio: config.completedOnboarding
          ? randomElement(config.bioPool || BIOS)
          : null,
        area: config.completedOnboarding ? randomElement(AREAS) : null,
        gender: config.completedOnboarding
          ? isMale
            ? "MALE"
            : "FEMALE"
          : null,
        status: config.status,
        completedOnboarding: config.completedOnboarding,
        role: Role.USER,
        emailVerified: true,
        dateOfBirth: config.completedOnboarding
          ? new Date(birthYear, birthMonth, birthDay)
          : null,
        lastLogin: config.completedOnboarding
          ? randomDate(daysAgo(30), new Date())
          : null,
        lastActivityCheck:
          config.status === UserStatus.ACTIVE
            ? randomDate(daysAgo(14), new Date())
            : null,
        createdAt,
      },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    // Add questionnaire responses and initial ratings for completed users
    if (config.completedOnboarding) {
      const sport = randomElement(["PICKLEBALL", "TENNIS", "PADEL"]);
      const response = await prisma.questionnaireResponse.create({
        data: {
          userId: user.id,
          sport: sport,
          qVersion: 1,
          qHash: `hash-${user.id}`,
          answersJson: { answers: ["option1", "option2", "option3"] },
          completedAt: createdAt,
        },
      });

      const doublesRating = 1200 + randomInt(-200, 400);
      await prisma.initialRatingResult.create({
        data: {
          responseId: response.id,
          source: "questionnaire",
          doubles: doublesRating,
          singles: doublesRating - randomInt(0, 100),
          rd: 150 + randomInt(-30, 30),
          confidence: randomElement(["LOW", "MEDIUM", "HIGH"]),
        },
      });
    }

    userIndex++;
    return user;
  }

  // Create active users with complete profiles (spread over 12 months)
  logProgress(
    `Creating ${userConfig.activeComplete} active users with complete profiles...`
  );
  for (let i = 0; i < userConfig.activeComplete; i++) {
    const user = await createUser({
      status: UserStatus.ACTIVE,
      completedOnboarding: true,
      createdAtRange: [monthsAgo(12), daysAgo(7)],
    });
    if (user) createdUsers.push(user);

    if ((i + 1) % 100 === 0) {
      logProgress(`   Active complete: ${i + 1}/${userConfig.activeComplete}`);
    }
  }

  // Create active users with incomplete onboarding (recent signups)
  logProgress(
    `Creating ${userConfig.activeIncomplete} users with incomplete onboarding...`
  );
  for (let i = 0; i < userConfig.activeIncomplete; i++) {
    const user = await createUser({
      status: UserStatus.ACTIVE,
      completedOnboarding: false,
      createdAtRange: [daysAgo(30), daysAgo(1)],
    });
    if (user) createdUsers.push(user);
  }

  // Create inactive users
  logProgress(`Creating ${userConfig.inactive} inactive users...`);
  const inactiveBios = [
    "Haven't played in a while.",
    "Taking a break.",
    "Will be back soon.",
    "On hiatus.",
    "Busy with work.",
  ];
  for (let i = 0; i < userConfig.inactive; i++) {
    const user = await createUser({
      status: UserStatus.INACTIVE,
      completedOnboarding: true,
      createdAtRange: [monthsAgo(12), monthsAgo(3)],
      bioPool: inactiveBios,
    });
    if (user) createdUsers.push(user);
  }

  // Create suspended users
  logProgress(`Creating ${userConfig.suspended} suspended users...`);
  const suspendedBios = [
    "Account suspended.",
    "Violation of terms.",
    "Under review.",
  ];
  for (let i = 0; i < userConfig.suspended; i++) {
    const user = await createUser({
      status: UserStatus.SUSPENDED,
      completedOnboarding: true,
      createdAtRange: [monthsAgo(10), monthsAgo(1)],
      bioPool: suspendedBios,
    });
    if (user) createdUsers.push(user);
  }

  logSuccess(`Created ${createdUsers.length} users (password: Test@123)`);
  logProgress(`- ${userConfig.activeComplete} active with complete profiles`);
  logProgress(
    `- ${userConfig.activeIncomplete} active with incomplete onboarding`
  );
  logProgress(`- ${userConfig.inactive} inactive`);
  logProgress(`- ${userConfig.suspended} suspended`);

  return createdUsers;
}

// =============================================
// SEED ADMIN INVITE TOKENS
// =============================================

export async function seedAdminInviteTokens(
  admins: SeededAdmin[]
): Promise<void> {
  logSection("🎫 Seeding admin invite tokens...");

  const pendingAdmins = await prisma.admin.findMany({
    where: { status: AdminStatus.PENDING },
    include: { user: true },
  });

  let created = 0;

  for (const admin of pendingAdmins) {
    const existingToken = await prisma.adminInviteToken.findUnique({
      where: { adminId: admin.id },
    });

    if (!existingToken) {
      await prisma.adminInviteToken.create({
        data: {
          adminId: admin.id,
          email: admin.user.email,
          token: `invite_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}`,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} admin invite tokens`);
}

// =============================================
// SEED NOTIFICATION PREFERENCES
// =============================================

export async function seedNotificationPreferences(
  users: User[]
): Promise<void> {
  logSection("🔔 Seeding notification preferences...");

  const activeUsers = users.filter(
    (u) => u.status === UserStatus.ACTIVE && u.completedOnboarding
  );
  let created = 0;

  for (const user of activeUsers) {
    const existing = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });

    if (!existing) {
      await prisma.notificationPreference.create({
        data: {
          userId: user.id,
          matchReminders: true,
          matchRescheduled: true,
          matchCancelled: true,
          matchResults: true,
          partnerChange: randomElement([true, false]),
          opponentChange: true,
          ratingChange: true,
          inactivityAlerts: randomElement([true, false]),
          chatNotifications: true,
          invitations: true,
          seasonRegistration: true,
          seasonUpdates: randomElement([true, false]),
          disputeAlerts: true,
          teamChangeRequests: true,
          withdrawalRequests: true,
          playerReports: true,
          seasonJoinRequests: true,
          pushEnabled: true,
          emailEnabled: randomElement([true, false]),
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} notification preferences`);
}

// =============================================
// SEED USER PUSH TOKENS
// =============================================

export async function seedUserPushTokens(users: User[]): Promise<void> {
  logSection("📱 Seeding user push tokens...");

  const activeUsers = users.filter(
    (u) => u.status === UserStatus.ACTIVE && u.completedOnboarding
  );
  let created = 0;

  for (const user of activeUsers) {
    const existing = await prisma.userPushToken.findFirst({
      where: { userId: user.id },
    });

    if (!existing) {
      const platform = randomElement(["ios", "android", "web"]);
      await prisma.userPushToken.create({
        data: {
          userId: user.id,
          token: `${platform}_token_${user.id}_${Date.now()}`,
          platform: platform,
          deviceId: `device_${user.id.slice(0, 8)}`,
          isActive: true,
          failureCount: 0,
          lastUsedAt: randomDate(daysAgo(7), new Date()),
        },
      });
      created++;
    }
  }

  logSuccess(`Created ${created} user push tokens`);
}
