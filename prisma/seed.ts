import {
  Prisma,
  PrismaClient,
  GameType,
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
    where: { name: "Subang Pickleball League" },
  });

  if (existingLeague) {
    console.log("   League already exists, skipping seed...");
    const existingSeason = await prisma.season.findFirst({
      where: { leagues: { some: { id: existingLeague.id } } }
    });
    return { league: existingLeague, season: existingSeason };
  }

  // Create main league with categories
  const league = await prisma.league.create({
    data: {
      name: "Subang Pickleball League",
      location: "Subang Jaya",
      sportType: SportType.PICKLEBALL,
      gameType: GameType.DOUBLES,
      status: Statuses.ACTIVE,
      ...(createdByAdminId ? { createdById: createdByAdminId } : {}),
      description: "Premier pickleball league in Subang with multiple categories for all skill levels.",
      categories: {
        create: [
          {
            name: "Men's Singles",
            game_type: GameType.SINGLES,
            gender_category: "MALE",
            genderRestriction: "MALE",
            matchFormat: "Best of 3 sets",
            isActive: true,
            categoryOrder: 1,
          },
          {
            name: "Women's Singles",
            game_type: GameType.SINGLES,
            gender_category: "FEMALE",
            genderRestriction: "FEMALE",
            matchFormat: "Best of 3 sets",
            isActive: true,
            categoryOrder: 2,
          },
          {
            name: "Men's Doubles",
            game_type: GameType.DOUBLES,
            gender_category: "MALE",
            genderRestriction: "MALE",
            matchFormat: "Best of 3 sets",
            isActive: true,
            categoryOrder: 3,
          },
          {
            name: "Women's Doubles",
            game_type: GameType.DOUBLES,
            gender_category: "FEMALE",
            genderRestriction: "FEMALE",
            matchFormat: "Best of 3 sets",
            isActive: true,
            categoryOrder: 4,
          },
          {
            name: "Mixed Doubles",
            game_type: GameType.DOUBLES,
            gender_category: "MIXED",
            genderRestriction: "MIXED",
            matchFormat: "Best of 3 sets",
            isActive: true,
            categoryOrder: 5,
          },
        ]
      }
    },
    include: {
      categories: true
    }
  });

  const categories = league.categories;

  console.log(`   Created ${categories.length} categories for league`);

  // Create seasons for each category
  // Create league-season-category relationship via update
  const seasons = [];

  // Season 1 (Active) - for all categories
  for (const category of categories) {
    const season = await prisma.season.create({
      data: {
        name: `S1 - ${category.name}`,
        entryFee: new Prisma.Decimal(50),
        status: "ACTIVE",
        isActive: true,
        description: `Season 1 for ${category.name}. Registration open!`,
        paymentRequired: false,
        promoCodeSupported: false,
        withdrawalEnabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        regiDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Connect season to league and category
    await prisma.season.update({
      where: { id: season.id },
      data: {
        leagues: { connect: { id: league.id } },
        categories: { connect: { id: category.id } }
      }
    });

    seasons.push(season);
  }

  // Season 2 (Upcoming) - for Mixed Doubles only
  const mixedDoublesCategory = categories.find(c => c.name === "Mixed Doubles");
  if (mixedDoublesCategory) {
    const upcomingSeason = await prisma.season.create({
      data: {
        name: `S2 - Mixed Doubles`,
        entryFee: new Prisma.Decimal(60),
        status: "UPCOMING",
        isActive: false,
        description: "Upcoming Season 2 for Mixed Doubles.",
        paymentRequired: true,
        promoCodeSupported: true,
        withdrawalEnabled: false,
        startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
        endDate: new Date(Date.now() + 135 * 24 * 60 * 60 * 1000), // 135 days
        regiDeadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000), // 40 days
      },
    });

    // Connect season to league and category
    await prisma.season.update({
      where: { id: upcomingSeason.id },
      data: {
        leagues: { connect: { id: league.id } },
        categories: { connect: { id: mixedDoublesCategory.id } }
      }
    });

    seasons.push(upcomingSeason);
  }

  console.log(`   Created ${seasons.length} seasons`);

  return { league, season: seasons[0], categories, seasons };
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
    console.log("✅ Subang Pickleball League created");
    console.log("   - League: Subang Pickleball League (ACTIVE)");
    console.log("   - Categories: 5 (Men's/Women's Singles, Men's/Women's/Mixed Doubles)");
    console.log("   - Seasons: 6 (5 Active S1 + 1 Upcoming S2)\n");

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
