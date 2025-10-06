import { PrismaClient, LeagueDurationUnit } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing templates (optional - comment out if you want to keep existing data)
  console.log("🗑️  Clearing existing league templates...");
  await prisma.leagueTemplate.deleteMany({});

  console.log("📝 Creating league templates for different sports...");

  // Tennis League Template
  await prisma.leagueTemplate.create({
    data: {
      name: "Standard Tennis League",
      sport: "Tennis",
      description: "Default template for recreational tennis leagues with singles and doubles divisions",
      settings: {
        durationUnit: LeagueDurationUnit.WEEKS,
        durationValue: 8,
        minPlayersPerDivision: 4,
        maxPlayersPerDivision: 12,
        registrationDeadlineDays: 7,
        paymentSettings: {
          fees: {
            percentage: 0,
            flat: 50,
            currency: "USD"
          },
          refundPolicy: "Full refund up to 7 days before league start, 50% refund within 7 days",
          paymentMethods: ["credit_card", "bank_transfer", "cash"],
        },
        divisionRules: {
          ratingRanges: [
            { name: "Beginner", minRating: 0, maxRating: 2.5 },
            { name: "Intermediate", minRating: 2.5, maxRating: 4.0 },
            { name: "Advanced", minRating: 4.0, maxRating: 5.5 },
            { name: "Elite", minRating: 5.5, maxRating: 7.0 },
          ],
          allowManualAssignment: true,
          autoAssignByRating: true,
        },
        playoffConfiguration: {
          enabled: true,
          format: "single_elimination",
          seededBy: "regular_season",
          topPlayersQualify: 8,
        },
        finalsConfiguration: {
          bestOf: 3,
          venue: "TBD",
          tiebreakRules: "Standard USTA rules",
        },
        customRulesText: "Standard USTA rules apply. Players must arrive 15 minutes before match time. Default scoring is best of 3 sets with a 10-point match tiebreak in lieu of third set.",
      },
    },
  });

  // Badminton League Template
  await prisma.leagueTemplate.create({
    data: {
      name: "Standard Badminton League",
      sport: "Badminton",
      description: "Default template for badminton leagues with mixed skill levels",
      settings: {
        durationUnit: LeagueDurationUnit.WEEKS,
        durationValue: 6,
        minPlayersPerDivision: 4,
        maxPlayersPerDivision: 16,
        registrationDeadlineDays: 5,
        paymentSettings: {
          fees: {
            percentage: 0,
            flat: 40,
            currency: "USD"
          },
          refundPolicy: "Full refund up to 5 days before league start",
          paymentMethods: ["credit_card", "bank_transfer"],
        },
        divisionRules: {
          ratingRanges: [
            { name: "Recreational", minRating: 0, maxRating: 3.0 },
            { name: "Intermediate", minRating: 3.0, maxRating: 4.5 },
            { name: "Advanced", minRating: 4.5, maxRating: 6.0 },
          ],
          allowManualAssignment: true,
          autoAssignByRating: true,
        },
        playoffConfiguration: {
          enabled: true,
          format: "round_robin",
          seededBy: "regular_season",
          topPlayersQualify: 4,
        },
        finalsConfiguration: {
          bestOf: 3,
          venue: "TBD",
        },
        customRulesText: "BWF rules apply. Matches are best of 3 games to 21 points. Shuttlecocks provided by venue.",
      },
    },
  });

  // Basketball League Template
  await prisma.leagueTemplate.create({
    data: {
      name: "Recreational Basketball League",
      sport: "Basketball",
      description: "Default template for recreational 5v5 basketball leagues",
      settings: {
        durationUnit: LeagueDurationUnit.WEEKS,
        durationValue: 10,
        minPlayersPerDivision: 8,
        maxPlayersPerDivision: 16,
        registrationDeadlineDays: 10,
        paymentSettings: {
          fees: {
            percentage: 0,
            flat: 100,
            currency: "USD"
          },
          refundPolicy: "Full refund up to 10 days before league start, 50% refund within 10 days",
          paymentMethods: ["credit_card", "bank_transfer"],
        },
        divisionRules: {
          ratingRanges: [
            { name: "Recreational", minRating: 0, maxRating: 3.0 },
            { name: "Competitive", minRating: 3.0, maxRating: 5.0 },
          ],
          allowManualAssignment: true,
          autoAssignByRating: false,
        },
        playoffConfiguration: {
          enabled: true,
          format: "single_elimination",
          seededBy: "regular_season",
          topPlayersQualify: 8,
        },
        finalsConfiguration: {
          bestOf: 1,
          venue: "TBD",
        },
        customRulesText: "FIBA rules apply. Teams must have minimum 8 players. Games are 4x10 minute quarters.",
      },
    },
  });

  // Pickleball League Template
  await prisma.leagueTemplate.create({
    data: {
      name: "Standard Pickleball League",
      sport: "Pickleball",
      description: "Default template for doubles pickleball leagues",
      settings: {
        durationUnit: LeagueDurationUnit.WEEKS,
        durationValue: 6,
        minPlayersPerDivision: 4,
        maxPlayersPerDivision: 12,
        registrationDeadlineDays: 7,
        paymentSettings: {
          fees: {
            percentage: 0,
            flat: 45,
            currency: "USD"
          },
          refundPolicy: "Full refund up to 7 days before league start",
          paymentMethods: ["credit_card", "bank_transfer", "cash"],
        },
        divisionRules: {
          ratingRanges: [
            { name: "Beginner (2.0-2.5)", minRating: 2.0, maxRating: 2.5 },
            { name: "Intermediate (3.0-3.5)", minRating: 3.0, maxRating: 3.5 },
            { name: "Advanced (4.0-4.5)", minRating: 4.0, maxRating: 4.5 },
            { name: "Expert (5.0+)", minRating: 5.0, maxRating: 6.0 },
          ],
          allowManualAssignment: true,
          autoAssignByRating: true,
        },
        playoffConfiguration: {
          enabled: true,
          format: "round_robin",
          seededBy: "regular_season",
          topPlayersQualify: 6,
        },
        finalsConfiguration: {
          bestOf: 3,
          venue: "TBD",
        },
        customRulesText: "USA Pickleball rules apply. Matches are best of 3 games to 11 points, win by 2. All equipment provided.",
      },
    },
  });

  // Table Tennis League Template
  await prisma.leagueTemplate.create({
    data: {
      name: "Standard Table Tennis League",
      sport: "Table Tennis",
      description: "Default template for table tennis singles leagues",
      settings: {
        durationUnit: LeagueDurationUnit.WEEKS,
        durationValue: 6,
        minPlayersPerDivision: 4,
        maxPlayersPerDivision: 12,
        registrationDeadlineDays: 5,
        paymentSettings: {
          fees: {
            percentage: 0,
            flat: 35,
            currency: "USD"
          },
          refundPolicy: "Full refund up to 5 days before league start",
          paymentMethods: ["credit_card", "bank_transfer"],
        },
        divisionRules: {
          ratingRanges: [
            { name: "Beginner", minRating: 0, maxRating: 1500 },
            { name: "Intermediate", minRating: 1500, maxRating: 2000 },
            { name: "Advanced", minRating: 2000, maxRating: 2500 },
          ],
          allowManualAssignment: true,
          autoAssignByRating: true,
        },
        playoffConfiguration: {
          enabled: true,
          format: "single_elimination",
          seededBy: "regular_season",
          topPlayersQualify: 8,
        },
        finalsConfiguration: {
          bestOf: 5,
          venue: "TBD",
        },
        customRulesText: "ITTF rules apply. Matches are best of 5 games to 11 points. Tables and equipment provided.",
      },
    },
  });

  // Volleyball League Template
  await prisma.leagueTemplate.create({
    data: {
      name: "Recreational Volleyball League",
      sport: "Volleyball",
      description: "Default template for 6v6 recreational volleyball leagues",
      settings: {
        durationUnit: LeagueDurationUnit.WEEKS,
        durationValue: 8,
        minPlayersPerDivision: 6,
        maxPlayersPerDivision: 12,
        registrationDeadlineDays: 7,
        paymentSettings: {
          fees: {
            percentage: 0,
            flat: 80,
            currency: "USD"
          },
          refundPolicy: "Full refund up to 7 days before league start, 50% refund within 7 days",
          paymentMethods: ["credit_card", "bank_transfer"],
        },
        divisionRules: {
          ratingRanges: [
            { name: "Recreational", minRating: 0, maxRating: 3.0 },
            { name: "Intermediate", minRating: 3.0, maxRating: 4.5 },
            { name: "Competitive", minRating: 4.5, maxRating: 6.0 },
          ],
          allowManualAssignment: true,
          autoAssignByRating: false,
        },
        playoffConfiguration: {
          enabled: true,
          format: "single_elimination",
          seededBy: "regular_season",
          topPlayersQualify: 8,
        },
        finalsConfiguration: {
          bestOf: 3,
          venue: "TBD",
        },
        customRulesText: "FIVB rules apply. Matches are best of 3 sets to 25 points (win by 2). Teams must have minimum 6 players.",
      },
    },
  });

  // Soccer League Template
  await prisma.leagueTemplate.create({
    data: {
      name: "Recreational Soccer League",
      sport: "Soccer (Football)",
      description: "Default template for recreational soccer leagues",
      settings: {
        durationUnit: LeagueDurationUnit.WEEKS,
        durationValue: 12,
        minPlayersPerDivision: 8,
        maxPlayersPerDivision: 16,
        registrationDeadlineDays: 14,
        paymentSettings: {
          fees: {
            percentage: 0,
            flat: 120,
            currency: "USD"
          },
          refundPolicy: "Full refund up to 14 days before league start, 50% refund within 14 days",
          paymentMethods: ["credit_card", "bank_transfer"],
        },
        divisionRules: {
          ratingRanges: [
            { name: "Recreational", minRating: 0, maxRating: 3.0 },
            { name: "Competitive", minRating: 3.0, maxRating: 5.0 },
          ],
          allowManualAssignment: true,
          autoAssignByRating: false,
        },
        playoffConfiguration: {
          enabled: true,
          format: "single_elimination",
          seededBy: "regular_season",
          topPlayersQualify: 8,
        },
        finalsConfiguration: {
          bestOf: 1,
          venue: "TBD",
        },
        customRulesText: "FIFA rules apply. Matches are 2x45 minute halves. Teams must have minimum 11 players (including goalkeeper).",
      },
    },
  });

  // Squash League Template
  await prisma.leagueTemplate.create({
    data: {
      name: "Standard Squash League",
      sport: "Squash",
      description: "Default template for squash singles leagues",
      settings: {
        durationUnit: LeagueDurationUnit.WEEKS,
        durationValue: 8,
        minPlayersPerDivision: 4,
        maxPlayersPerDivision: 10,
        registrationDeadlineDays: 7,
        paymentSettings: {
          fees: {
            percentage: 0,
            flat: 60,
            currency: "USD"
          },
          refundPolicy: "Full refund up to 7 days before league start",
          paymentMethods: ["credit_card", "bank_transfer"],
        },
        divisionRules: {
          ratingRanges: [
            { name: "C Division", minRating: 0, maxRating: 2.5 },
            { name: "B Division", minRating: 2.5, maxRating: 4.0 },
            { name: "A Division", minRating: 4.0, maxRating: 6.0 },
          ],
          allowManualAssignment: true,
          autoAssignByRating: true,
        },
        playoffConfiguration: {
          enabled: true,
          format: "single_elimination",
          seededBy: "regular_season",
          topPlayersQualify: 4,
        },
        finalsConfiguration: {
          bestOf: 5,
          venue: "TBD",
        },
        customRulesText: "WSF rules apply. Matches are best of 5 games to 11 points (PAR scoring). Court shoes required.",
      },
    },
  });

  console.log("✅ Successfully created 8 league templates!");

  // Create admin user for dl-admin login
  console.log("👤 Creating admin user...");

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@dleague.com" },
  });

  if (!existingAdmin) {
    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        name: "Admin User",
        email: "admin@dleague.com",
        username: "admin",
        role: "ADMIN",
        emailVerified: true,
        completedOnboarding: true,
        status: "active",
      },
    });

    // Hash password for admin account using better-auth's crypto
    const hashedPassword = await hashPassword("Admin@123");

    // Create account with password for admin
    await prisma.account.create({
      data: {
        userId: adminUser.id,
        accountId: adminUser.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    // Create Admin record
    await prisma.admin.create({
      data: {
        userId: adminUser.id,
        status: "ACTIVE",
      },
    });

    console.log("✅ Admin user created:");
    console.log("   Email: admin@dleague.com");
    console.log("   Username: admin");
    console.log("   Password: Admin@123");
    console.log("   Role: ADMIN");
  } else {
    console.log("ℹ️  Admin user already exists, skipping creation");
  }

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
