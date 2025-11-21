/**
 * Migration Script: Populate PlayerRating from QuestionnaireResult
 *
 * This script migrates existing questionnaire results to PlayerRating table
 * so that the rating system and bracket seeding work correctly.
 *
 * Run with: npx ts-node src/scripts/migrateQuestionnaireToPlayerRating.ts
 */

import { PrismaClient, GameType, SportType, RatingChangeReason } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  totalUsers: number;
  singlesCreated: number;
  doublesCreated: number;
  skipped: number;
  errors: string[];
}

async function migrateQuestionnaireToPlayerRating(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalUsers: 0,
    singlesCreated: 0,
    doublesCreated: 0,
    skipped: 0,
    errors: []
  };

  console.log('Starting migration: QuestionnaireResult -> PlayerRating');
  console.log('='.repeat(60));

  // Get the current active season as fallback
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startDate: 'desc' }
  });

  if (!activeSeason) {
    console.log('No active season found. Creating ratings without seasonId constraint...');
  } else {
    console.log(`Using active season: ${activeSeason.name} (${activeSeason.id})`);
  }

  // Get all users with completed questionnaire responses
  const usersWithQuestionnaires = await prisma.questionnaireResponse.findMany({
    where: {
      completedAt: { not: null },
      result: { isNot: null }
    },
    include: {
      result: true,
      user: {
        select: {
          id: true,
          name: true,
          seasonMemberships: {
            where: { status: 'ACTIVE' },
            select: {
              seasonId: true,
              divisionId: true
            },
            orderBy: { joinedAt: 'desc' },
            take: 1
          }
        }
      }
    }
  });

  console.log(`Found ${usersWithQuestionnaires.length} questionnaire responses to migrate`);

  for (const response of usersWithQuestionnaires) {
    stats.totalUsers++;

    if (!response.result || !response.user) {
      stats.skipped++;
      continue;
    }

    const { userId, sport } = response;
    const { singles, doubles, rd } = response.result;
    const seasonMembership = response.user.seasonMemberships[0];

    // Use season from membership, or fall back to active season
    const seasonId = seasonMembership?.seasonId || activeSeason?.id;

    if (!seasonId) {
      stats.errors.push(`No season available for user ${userId}`);
      continue;
    }

    // Determine sport type from string
    let sportType: SportType;
    switch (sport.toLowerCase()) {
      case 'tennis':
        sportType = SportType.TENNIS;
        break;
      case 'pickleball':
        sportType = SportType.PICKLEBALL;
        break;
      case 'padel':
        sportType = SportType.PADEL;
        break;
      default:
        stats.errors.push(`Unknown sport: ${sport} for user ${userId}`);
        continue;
    }

    try {
      // Create singles rating if exists
      if (singles) {
        // Check if already exists
        const existingSingles = await prisma.playerRating.findFirst({
          where: {
            userId,
            sport: sportType,
            gameType: GameType.SINGLES,
            seasonId
          }
        });

        if (!existingSingles) {
          const singlesData: any = {
            userId,
            seasonId,
            sport: sportType,
            gameType: GameType.SINGLES,
            currentRating: singles,
            ratingDeviation: rd || 350,
            isProvisional: true,
            matchesPlayed: 0,
            peakRating: singles,
            peakRatingDate: new Date(),
            lowestRating: singles
          };
          if (seasonMembership?.divisionId) singlesData.divisionId = seasonMembership.divisionId;

          const singlesRating = await prisma.playerRating.create({
            data: singlesData
          });

          // Create initial rating history
          await prisma.ratingHistory.create({
            data: {
              playerRatingId: singlesRating.id,
              ratingBefore: 1500, // Base rating
              ratingAfter: singles,
              delta: singles - 1500,
              rdBefore: 350,
              rdAfter: rd || 350,
              reason: RatingChangeReason.INITIAL_PLACEMENT,
              notes: `Migrated from questionnaire result (${sport})`
            }
          });

          stats.singlesCreated++;
          console.log(`  ✅ Created singles rating for ${response.user.name || userId}: ${singles}`);
        } else {
          console.log(`  ⏭️ Singles rating already exists for ${response.user.name || userId}`);
        }
      }

      // Create doubles rating if exists
      if (doubles) {
        const existingDoubles = await prisma.playerRating.findFirst({
          where: {
            userId,
            sport: sportType,
            gameType: GameType.DOUBLES,
            seasonId
          }
        });

        if (!existingDoubles) {
          const doublesData: any = {
            userId,
            seasonId,
            sport: sportType,
            gameType: GameType.DOUBLES,
            currentRating: doubles,
            ratingDeviation: rd || 350,
            isProvisional: true,
            matchesPlayed: 0,
            peakRating: doubles,
            peakRatingDate: new Date(),
            lowestRating: doubles
          };
          if (seasonMembership?.divisionId) doublesData.divisionId = seasonMembership.divisionId;

          const doublesRating = await prisma.playerRating.create({
            data: doublesData
          });

          // Create initial rating history
          await prisma.ratingHistory.create({
            data: {
              playerRatingId: doublesRating.id,
              ratingBefore: 1500,
              ratingAfter: doubles,
              delta: doubles - 1500,
              rdBefore: 350,
              rdAfter: rd || 350,
              reason: RatingChangeReason.INITIAL_PLACEMENT,
              notes: `Migrated from questionnaire result (${sport} doubles)`
            }
          });

          stats.doublesCreated++;
          console.log(`  ✅ Created doubles rating for ${response.user.name || userId}: ${doubles}`);
        } else {
          console.log(`  ⏭️ Doubles rating already exists for ${response.user.name || userId}`);
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      stats.errors.push(`Error for user ${userId}: ${errorMsg}`);
      console.error(`  ❌ Error for ${response.user.name || userId}: ${errorMsg}`);
    }
  }

  return stats;
}

async function main() {
  try {
    const stats = await migrateQuestionnaireToPlayerRating();

    console.log('\n' + '='.repeat(60));
    console.log('Migration Complete!');
    console.log('='.repeat(60));
    console.log(`Total users processed: ${stats.totalUsers}`);
    console.log(`Singles ratings created: ${stats.singlesCreated}`);
    console.log(`Doubles ratings created: ${stats.doublesCreated}`);
    console.log(`Skipped: ${stats.skipped}`);

    if (stats.errors.length > 0) {
      console.log(`\nErrors (${stats.errors.length}):`);
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

    // Verify migration
    const totalRatings = await prisma.playerRating.count();
    const totalHistory = await prisma.ratingHistory.count();
    console.log(`\nVerification:`);
    console.log(`  Total PlayerRating records: ${totalRatings}`);
    console.log(`  Total RatingHistory records: ${totalHistory}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
