/**
 * Quick utility to seed a joinable singles season (no partner needed, no payment required).
 * Run inside the backend container:
 *   docker compose exec backend npx tsx prisma/seeds/createSingleSeason.ts
 */
import { Prisma, PrismaClient, GameType, GenderRestriction, DivisionLevel, SeasonStatus, SportType, Statuses, GenderType } from "@prisma/client";

const prisma = new PrismaClient();

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  const leagueName = "Open Singles Test League";
  const seasonName = `Open Singles Paid Test Season ${new Date().toISOString().slice(0, 10)}`;
  const divisionName = "Open Singles Division";
  const categoryName = "Open Singles Category";

  // League (singles-only)
  let league = await prisma.league.findFirst({ where: { name: leagueName } });
  if (!league) {
    league = await prisma.league.create({
      data: {
        name: leagueName,
        description: "Test league for quick singles registration",
        location: "Test Venue",
        status: Statuses.ACTIVE,
        sportType: SportType.PICKLEBALL,
        gameType: GameType.SINGLES,
      },
    });
  }

  // Category (singles, open to all)
  let category = await prisma.category.findFirst({ where: { name: categoryName } });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: categoryName,
        genderRestriction: GenderRestriction.OPEN,
        matchFormat: "Best of 3",
        gameType: GameType.SINGLES,
        genderCategory: GenderType.MIXED,
        categoryOrder: 1,
      },
    });
  }

  // Season (active, no payment required)
  const season = await prisma.season.create({
    data: {
      name: seasonName,
      description: "Join immediately without payment or partner.",
      startDate: addDays(0),
      endDate: addDays(30),
      regiDeadline: addDays(20),
      entryFee: new Prisma.Decimal(50),
      status: SeasonStatus.ACTIVE,
      isActive: true,
      paymentRequired: true,
      promoCodeSupported: false,
      withdrawalEnabled: false,
      leagues: { connect: { id: league.id } },
      category: { connect: { id: category.id } },
    },
  });

  // Division (singles)
  await prisma.division.create({
    data: {
      name: divisionName,
      description: "Singles division for quick registration",
      level: DivisionLevel.INTERMEDIATE,
      gameType: GameType.SINGLES,
      genderCategory: GenderType.MIXED,
      maxSinglesPlayers: 128,
      currentSinglesCount: 0,
      autoAssignmentEnabled: false,
      isActiveDivision: true,
      seasonId: season.id,
      leagueId: league.id,
    },
  });

  console.log("✅ Created joinable singles season:", { seasonName, leagueName, categoryName, divisionName });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
