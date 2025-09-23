const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createMinimalTestData() {
  try {
    console.log('🌱 Creating minimal test data for payment testing...');

    // Create test league if it doesn't exist
    const subangLeague = await prisma.league.upsert({
      where: { id: 'league_subang' },
      update: {},
      create: {
        id: 'league_subang',
        name: 'Subang League',
        sport: 'Pickleball',
        location: 'Subang Jaya',
        description: 'Test league for payment integration',
        isActive: true,
      }
    });

    console.log('✅ Created/found league:', subangLeague.name);

    // Create test season if it doesn't exist
    const winterSeason = await prisma.leagueSeason.upsert({
      where: { id: 'season_winter_2025' },
      update: {},
      create: {
        id: 'season_winter_2025',
        leagueId: 'league_subang',
        name: 'Winter Season 2025',
        startDate: new Date('2025-12-01'),
        endDate: new Date('2026-01-31'),
        registrationEnd: new Date('2025-11-30'),
        entryFee: 59.90,
        maxParticipants: 100,
        category: 'Men\'s Single',
        status: 'OPEN_REGISTRATION',
      }
    });

    console.log('✅ Created/found season:', winterSeason.name);

    console.log('🎉 Minimal test data ready!');
    console.log('📋 League ID:', subangLeague.id);
    console.log('📋 Season ID:', winterSeason.id);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createMinimalTestData()
  .then(() => {
    console.log('✅ Done! You can now test the payment flow.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });