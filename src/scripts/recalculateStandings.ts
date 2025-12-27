/**
 * Script to recalculate division standings using V2 service
 * This fixes corrupted standings data caused by legacy double-counting bug
 * 
 * Usage: npx ts-node src/scripts/recalculateStandings.ts [divisionId]
 * 
 * If no divisionId is provided, it will recalculate ALL divisions
 */

import { prisma } from '../lib/prisma';
import { StandingsV2Service } from '../services/rating/standingsV2Service';

async function recalculateStandings(divisionId?: string) {
  const standingsV2 = new StandingsV2Service();

  try {
    if (divisionId) {
      // Recalculate specific division
      const division = await prisma.division.findUnique({
        where: { id: divisionId },
        include: { season: true }
      });

      if (!division) {
        console.error(`Division ${divisionId} not found`);
        return;
      }

      console.log(`\n🔄 Recalculating standings for division: ${division.name}`);
      console.log(`   Season: ${division.season?.name || 'Unknown'}`);

      await standingsV2.recalculateDivisionStandings(divisionId, division.seasonId);
      console.log(`✅ Successfully recalculated standings for ${division.name}`);

    } else {
      // Recalculate ALL divisions
      const divisions = await prisma.division.findMany({
        include: { season: true }
      });

      console.log(`\n🔄 Recalculating standings for ${divisions.length} divisions...`);

      for (const division of divisions) {
        try {
          console.log(`\n  Processing: ${division.name} (${division.season?.name || 'Unknown Season'})`);
          await standingsV2.recalculateDivisionStandings(division.id, division.seasonId);
          console.log(`  ✅ Done`);
        } catch (error) {
          console.error(`  ❌ Failed for ${division.name}:`, error);
        }
      }

      console.log(`\n✅ Finished recalculating all divisions`);
    }

    // Show updated standings
    console.log('\n📊 Updated Standings Summary:');
    
    const targetDivisionId = divisionId;
    const standings = await prisma.divisionStanding.findMany({
      where: targetDivisionId ? { divisionId: targetDivisionId } : {},
      include: {
        user: { select: { name: true } },
        division: { select: { name: true } }
      },
      orderBy: [
        { divisionId: 'asc' },
        { rank: 'asc' }
      ],
      take: 20 // Show top 20
    });

    console.log('\nRank | Player            | P  | W  | L  | Pts | Division');
    console.log('-----|-------------------|----|----|----|----|----------');
    
    for (const s of standings) {
      const name = (s.user?.name || 'Unknown').padEnd(17).substring(0, 17);
      const played = String(s.matchesPlayed).padStart(2);
      const wins = String(s.wins).padStart(2);
      const losses = String(s.losses).padStart(2);
      const pts = String(s.totalPoints).padStart(3);
      const division = (s.division?.name || 'Unknown').substring(0, 10);
      
      console.log(`${String(s.rank).padStart(4)} | ${name} | ${played} | ${wins} | ${losses} | ${pts} | ${division}`);
    }

  } catch (error) {
    console.error('❌ Error recalculating standings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get divisionId from command line args
const divisionIdArg = process.argv[2];

recalculateStandings(divisionIdArg);
