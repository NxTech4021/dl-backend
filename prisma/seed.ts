import {
  Prisma,
  PrismaClient,
  GameType,
  Gender,
  SportType,
  Statuses,
} from "@prisma/client";

const prisma = new PrismaClient();

type SeededAdmin = {
  userId: string;
  adminId?: string;
};

async function seedAdmin(): Promise<SeededAdmin> {
  const { hashPassword } = await import("better-auth/crypto");

  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@dleague.com" },
    include: { admin: true },
  });

  if (existingAdmin) {
    if (!existingAdmin.admin) {
      const adminRecord = await prisma.admin.create({
        data: {
          userId: existingAdmin.id,
          status: "ACTIVE",
        },
      });
      return { userId: existingAdmin.id, adminId: adminRecord.id };
    }
    return { userId: existingAdmin.id, adminId: existingAdmin.admin.id };
  }

  const adminUser = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@dleague.com",
      username: "admin",
      role: "ADMIN",
      emailVerified: true,
    },
  });

  const hashedPassword = await hashPassword("Admin@123");

  await prisma.account.create({
    data: {
      userId: adminUser.id,
      accountId: adminUser.id,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  const adminRecord = await prisma.admin.create({
    data: {
      userId: adminUser.id,
      status: "ACTIVE",
    },
  });

  return { userId: adminUser.id, adminId: adminRecord?.id ?? undefined };
}

async function seedTestUsers() {
  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword("Test@123");

  const testUsers = [
    {
      name: "Alice Johnson",
      email: "alice@test.com",
      username: "alice_j",
      bio: "Love playing doubles! Looking for partners.",
      area: "Kuala Lumpur",
      gender: "FEMALE",
    },
    {
      name: "Bob Smith",
      email: "bob@test.com",
      username: "bob_smith",
      bio: "Intermediate player, play for fun.",
      area: "Kuala Lumpur",
      gender: "MALE",
    },
    {
      name: "Charlie Brown",
      email: "charlie@test.com",
      username: "charlie_b",
      bio: "Advanced player, competitive mindset.",
      area: "Petaling Jaya",
      gender: "MALE",
    },
    {
      name: "Diana Prince",
      email: "diana@test.com",
      username: "diana_prince",
      bio: "Beginner looking to improve!",
      area: "Subang Jaya",
      gender: "FEMALE",
    },
    {
      name: "Ethan Hunt",
      email: "ethan@test.com",
      username: "ethan_h",
      bio: "Experienced doubles player.",
      area: "Kuala Lumpur",
      gender: "MALE",
    },
  ];

  const createdUsers = [];
  for (const userData of testUsers) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      createdUsers.push(existingUser);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        ...userData,
        role: "USER",
        emailVerified: true,
        completedOnboarding: true,
        dateOfBirth: new Date("1995-01-01"),
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

    // Add ratings for each user
    const response = await prisma.questionnaireResponse.create({
      data: {
        userId: user.id,
        sport: "PICKLEBALL",
        qVersion: 1,
        qHash: "test-hash",
        answersJson: {},
        completedAt: new Date(),
      },
    });

    const doublesRating = 1200 + Math.floor(Math.random() * 400); // 1200-1600
    await prisma.initialRatingResult.create({
      data: {
        responseId: response.id,
        source: "questionnaire",
        doubles: doublesRating,
        singles: doublesRating - 50,
        rd: 150,
        confidence: "MEDIUM",
      },
    });

    createdUsers.push(user);
  }

  return createdUsers;
}

async function seedLeagueAndSeason(createdByAdminId?: string) {
  const existingLeague = await prisma.league.findFirst({
    where: { name: "Demo Doubles League" },
  });

  if (existingLeague) {
    const existingSeason = await prisma.season.findFirst({
      where: { name: "Fall 2025 Season" },
    });
    return { league: existingLeague, season: existingSeason };
  }

  const league = await prisma.league.create({
    data: {
      name: "Demo Doubles League",
      location: "Kuala Lumpur",
      sportType: SportType.PICKLEBALL,
      gameType: GameType.DOUBLES,
      status: Statuses.ACTIVE,
      ...(createdByAdminId ? { createdById: createdByAdminId } : {}),
      description: "Doubles league for partner pairing testing.",
    },
  });

  const category = await prisma.category.create({
    data: {
      leagueId: league.id,
      name: "Open Doubles",
      genderRestriction: "MIXED",
      matchFormat: "Best of 3 sets",
      isActive: true,
      categoryOrder: 1,
    },
  });

  const season = await prisma.season.create({
    data: {
      name: "Fall 2025 Season",
      categoryId: category.id,
      entryFee: new Prisma.Decimal(50),
      status: "ACTIVE",
      isActive: true,
      description: "Active season for pairing and partner change testing.",
      paymentRequired: false,
      promoCodeSupported: false,
      withdrawalEnabled: true,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      regiDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      leagues: {
        connect: { id: league.id }
      }
    },
  });

  return { league, season };
}

async function main() {
  console.log("🌱 Starting database seed...\n");

  try {
    const admin = await seedAdmin();
    console.log("✅ Admin ready: admin@dleague.com / Admin@123\n");

    const testUsers = await seedTestUsers();
    console.log(`✅ Created ${testUsers.length} test users (all with password: Test@123)`);
    console.log("   - alice@test.com");
    console.log("   - bob@test.com");
    console.log("   - charlie@test.com");
    console.log("   - diana@test.com");
    console.log("   - ethan@test.com\n");

    const leagueSeason = await seedLeagueAndSeason(admin.adminId);
    console.log("✅ Demo Doubles League & Fall 2025 Season created");
    console.log("   - League: Demo Doubles League (ACTIVE)");
    console.log("   - Season: Fall 2025 Season (ACTIVE, withdrawalEnabled: true)\n");

    console.log("🌟 Database seeded successfully!");
    console.log("\n📝 You can now test the pairing module with these users!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
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
