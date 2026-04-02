/**
 * Internal Testing Team Seed Script
 * Creates test accounts for the team with various roles
 * Run with: npx tsx prisma/seeds/seed-test-team.ts
 */

import { PrismaClient, Role, UserStatus, AdminStatus, GenderType, SportType, GameType, SkillLevel } from "@prisma/client";

const prisma = new PrismaClient();

interface TeamMember {
  name: string;
  email: string;
  username: string;
  role: "player" | "admin" | "superadmin";
  gender: GenderType;
  sports: SportType[];
  skillLevel: SkillLevel;
}

// Your internal testing team
const TEAM_MEMBERS: TeamMember[] = [
  // Admin accounts
  {
    name: "Eddy",
    email: "eddy@deuceleague.test",
    username: "eddy_admin",
    role: "superadmin",
    gender: "MALE",
    sports: ["TENNIS", "PICKLEBALL", "PADEL"],
    skillLevel: "EXPERT",
  },
  {
    name: "Zawad",
    email: "zawad@deuceleague.test",
    username: "zawad_admin",
    role: "superadmin",
    gender: "MALE",
    sports: ["TENNIS", "PICKLEBALL"],
    skillLevel: "ADVANCED",
  },
  {
    name: "Najwa",
    email: "najwa@deuceleague.test",
    username: "najwa_admin",
    role: "admin",
    gender: "FEMALE",
    sports: ["TENNIS", "PADEL"],
    skillLevel: "INTERMEDIATE",
  },

  // Player accounts
  {
    name: "Ken",
    email: "ken@deuceleague.test",
    username: "ken_player",
    role: "player",
    gender: "MALE",
    sports: ["TENNIS", "PICKLEBALL"],
    skillLevel: "UPPER_INTERMEDIATE",
  },
  {
    name: "Yusuf",
    email: "yusuf@deuceleague.test",
    username: "yusuf_player",
    role: "player",
    gender: "MALE",
    sports: ["TENNIS"],
    skillLevel: "INTERMEDIATE",
  },
  {
    name: "Zureen",
    email: "zureen@deuceleague.test",
    username: "zureen_player",
    role: "player",
    gender: "FEMALE",
    sports: ["PICKLEBALL", "PADEL"],
    skillLevel: "IMPROVER",
  },
  {
    name: "Shufaa",
    email: "shufaa@deuceleague.test",
    username: "shufaa_player",
    role: "player",
    gender: "FEMALE",
    sports: ["TENNIS", "PICKLEBALL"],
    skillLevel: "BEGINNER",
  },
  {
    name: "Praveen",
    email: "praveen@deuceleague.test",
    username: "praveen_player",
    role: "player",
    gender: "MALE",
    sports: ["TENNIS", "PADEL"],
    skillLevel: "ADVANCED",
  },
  {
    name: "Hakim",
    email: "hakim@deuceleague.test",
    username: "hakim_player",
    role: "player",
    gender: "MALE",
    sports: ["PICKLEBALL"],
    skillLevel: "EXPERT",
  },
];

// Rating values based on skill level
const SKILL_TO_RATING: Record<SkillLevel, number> = {
  BEGINNER: 1000,
  IMPROVER: 1200,
  INTERMEDIATE: 1400,
  UPPER_INTERMEDIATE: 1600,
  ADVANCED: 1800,
  EXPERT: 2000,
};

async function seedTestTeam() {
  console.log("\n🧪 Seeding Internal Testing Team...\n");

  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword("Test@123");

  const createdUsers: any[] = [];

  for (const member of TEAM_MEMBERS) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: member.email },
    });

    if (existingUser) {
      console.log(`   ⏭️  Skipped: ${member.name} (${member.email}) - already exists`);
      createdUsers.push(existingUser);
      continue;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name: member.name,
        email: member.email,
        username: member.username,
        displayUsername: member.name,
        role: member.role === "superadmin" ? Role.SUPERADMIN : member.role === "admin" ? Role.ADMIN : Role.USER,
        emailVerified: true,
        completedOnboarding: true,
        status: UserStatus.ACTIVE,
        gender: member.gender,
        area: "Kuala Lumpur",
        dateOfBirth: new Date("1995-01-15"),
        bio: `Internal tester - ${member.name}`,
        createdAt: new Date(),
      },
    });

    // Create account with password
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    // Create admin record if needed
    if (member.role === "admin" || member.role === "superadmin") {
      await prisma.admin.create({
        data: {
          userId: user.id,
          status: AdminStatus.ACTIVE,
        },
      });
    }

    // Create user settings
    await prisma.userSettings.create({
      data: {
        userId: user.id,
        matchReminders: true,
        notifications: true,
      },
    });

    // Create ratings for each sport
    // Note: PlayerRating requires seasonId — ratings are created when
    // users register for seasons, not during account seeding.
    // The old `prisma.rating` model no longer exists.

    console.log(`   ✅ Created: ${member.name} (${member.email}) - ${member.role}`);
    createdUsers.push(user);
  }

  return createdUsers;
}

async function createTestSeason() {
  console.log("\n🏆 Creating Test Season...\n");

  // Check if league exists
  let league = await prisma.league.findFirst({
    where: { name: "Internal Testing League" },
  });

  if (!league) {
    league = await prisma.league.create({
      data: {
        name: "Internal Testing League",
        description: "League for internal testing purposes",
        sportType: "PICKLEBALL",
        gameType: "SINGLES",
        status: "ACTIVE",
      },
    });
    console.log("   ✅ Created: Internal Testing League");
  } else {
    console.log("   ⏭️  Skipped: Internal Testing League (already exists)");
  }

  // Check if season exists
  let season = await prisma.season.findFirst({
    where: { name: "Test Season January 2026" },
  });

  if (!season) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 2);

    season = await prisma.season.create({
      data: {
        name: "Test Season January 2026",
        leagues: { connect: { id: league.id } },
        startDate: startDate,
        endDate: endDate,
        regiDeadline: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        entryFee: 0, // Free for testing
        status: "ACTIVE",
        isActive: true,
      },
    });
    console.log("   ✅ Created: Test Season January 2026");
  } else {
    console.log("   ⏭️  Skipped: Test Season January 2026 (already exists)");
  }

  return { league, season };
}

async function createFriendships(users: any[]) {
  console.log("\n👥 Creating Test Friendships...\n");

  // Make some users friends
  const friendPairs = [
    [0, 2], // Zawad & Ken
    [1, 4], // Najwa & Zureen
    [2, 3], // Ken & Yusuf
    [5, 6], // Shufaa & Praveen
    [6, 7], // Praveen & Hakim
  ];

  for (const [i, j] of friendPairs) {
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: users[i].id, recipientId: users[j].id },
          { requesterId: users[j].id, recipientId: users[i].id },
        ],
      },
    });

    if (!existing) {
      await prisma.friendship.create({
        data: {
          requesterId: users[i].id,
          recipientId: users[j].id,
          status: "ACCEPTED",
        },
      });
      console.log(`   ✅ Friends: ${TEAM_MEMBERS[i].name} & ${TEAM_MEMBERS[j].name}`);
    } else {
      console.log(`   ⏭️  Skipped: ${TEAM_MEMBERS[i].name} & ${TEAM_MEMBERS[j].name} (already friends)`);
    }
  }
}

async function main() {
  console.log("🚀 Starting Internal Testing Team Setup...");
  console.log("━".repeat(60));

  try {
    // Create users
    const users = await seedTestTeam();

    // Create test season
    const { league, season } = await createTestSeason();

    // Create friendships
    await createFriendships(users);

    console.log("\n" + "━".repeat(60));
    console.log("\n✅ Internal Testing Setup Complete!\n");

    console.log("📋 TEST ACCOUNTS (Password: Test@123):");
    console.log("━".repeat(60));
    console.log("\n👑 ADMINS:");
    console.log("   • eddy@deuceleague.test (SUPERADMIN)");
    console.log("   • zawad@deuceleague.test (SUPERADMIN)");
    console.log("   • najwa@deuceleague.test (ADMIN)");

    console.log("\n🎾 PLAYERS:");
    console.log("   • ken@deuceleague.test");
    console.log("   • yusuf@deuceleague.test");
    console.log("   • zureen@deuceleague.test");
    console.log("   • shufaa@deuceleague.test");
    console.log("   • praveen@deuceleague.test");
    console.log("   • hakim@deuceleague.test");

    console.log("\n🏆 TEST LEAGUE & SEASON:");
    console.log("   • Internal Testing League");
    console.log("   • Test Season January 2026 (ACTIVE, FREE entry)");

    console.log("\n👥 PRE-CONFIGURED FRIENDSHIPS:");
    console.log("   • Zawad ↔ Ken");
    console.log("   • Najwa ↔ Zureen");
    console.log("   • Ken ↔ Yusuf");
    console.log("   • Shufaa ↔ Praveen");
    console.log("   • Praveen ↔ Hakim");

    console.log("\n📱 SUGGESTED TEST SCENARIOS:");
    console.log("━".repeat(60));
    console.log(`
1. MATCH FLOW TEST (Ken vs Yusuf - Tennis Singles):
   - Ken creates a friendly match
   - Ken invites Yusuf
   - Yusuf accepts
   - After "playing", Ken submits result (6-4, 6-3)
   - Yusuf confirms result
   - Check ratings updated

2. DOUBLES PARTNERSHIP TEST (Praveen & Hakim):
   - Praveen sends pair request to Hakim
   - Hakim accepts partnership
   - Create doubles match
   - Test partnership features

3. ADMIN DISPUTE TEST:
   - Ken creates match with Zureen
   - Ken submits wrong result
   - Zureen disputes result
   - Zawad (admin) reviews and resolves dispute

4. SEASON REGISTRATION TEST:
   - Shufaa registers for Test Season
   - Check she appears in available players
   - Assign her to a division

5. NOTIFICATION TEST:
   - Send friend request (Hakim → Shufaa)
   - Check notification appears
   - Test push notification delivery

6. PROFILE & DISCOVERY TEST:
   - Update player profiles
   - Search for players
   - Add to favorites
   - View match history
`);
    console.log("");

  } catch (error) {
    console.error("\n❌ Error setting up test team:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
