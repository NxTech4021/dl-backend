import { PrismaClient, LeagueTypeType, Gender } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// SPORTS LIST
// ============================================
// To add a new sport:
// 1. Add a new object to this array
// 2. Run: npm run seed
// 3. Deploy to production
// ============================================

const SPORTS_LIST = [
  { 
    name: 'Basketball', 
    description: 'Indoor court sport with hoops',
    pic_url: '/sports/basketball.png',
    isActive: true,
    sortOrder: 1
  },
  { 
    name: 'Tennis', 
    description: 'Racquet sport on court',
    pic_url: '/sports/tennis.png',
    isActive: true,
    sortOrder: 2
  },
  { 
    name: 'Soccer', 
    description: 'Team sport with ball',
    pic_url: '/sports/soccer.png',
    isActive: true,
    sortOrder: 3
  },
  { 
    name: 'Volleyball', 
    description: 'Net sport with ball',
    pic_url: '/sports/volleyball.png',
    isActive: true,
    sortOrder: 4
  },
  { 
    name: 'Badminton', 
    description: 'Racquet sport with shuttlecock',
    pic_url: '/sports/badminton.png',
    isActive: true,
    sortOrder: 5
  },
  { 
    name: 'Padel', 
    description: 'Racquet sport combining tennis and squash',
    pic_url: '/sports/padel.png',
    isActive: true,
    sortOrder: 6
  },
  { 
    name: 'Pickleball', 
    description: 'Paddle sport combining elements of tennis, badminton, and ping-pong',
    pic_url: '/sports/pickleball.png',
    isActive: true,
    sortOrder: 7
  },
  { 
    name: 'Table Tennis', 
    description: 'Indoor racquet sport also known as ping-pong',
    pic_url: '/sports/table-tennis.png',
    isActive: true,
    sortOrder: 8
  },
  // 👇 ADD NEW SPORTS HERE 👇
  // { 
  //   name: 'Your Sport', 
  //   description: 'Brief description',
  //   pic_url: '/sports/your-sport.png',
  //   isActive: true,
  //   sortOrder: 9
  // },
];

// ============================================
// 🏆 LEAGUE TYPES
// ============================================
// Standard combinations of format + gender
// To add a new league type:
// 1. Add a new object to this array
// 2. Run: npm run seed
// 3. Deploy to production
// ============================================

const LEAGUE_TYPES = [
  { 
    name: "Men's Singles", 
    description: 'Individual male competition',
    type: LeagueTypeType.SINGLES, 
    gender: Gender.MALE,
    isActive: true,
    sortOrder: 1
  },
  { 
    name: "Women's Singles", 
    description: 'Individual female competition',
    type: LeagueTypeType.SINGLES, 
    gender: Gender.FEMALE,
    isActive: true,
    sortOrder: 2
  },
  { 
    name: "Men's Doubles", 
    description: 'Two-player male teams',
    type: LeagueTypeType.DOUBLES, 
    gender: Gender.MALE,
    isActive: true,
    sortOrder: 3
  },
  { 
    name: "Women's Doubles", 
    description: 'Two-player female teams',
    type: LeagueTypeType.DOUBLES, 
    gender: Gender.FEMALE,
    isActive: true,
    sortOrder: 4
  },
  { 
    name: 'Mixed Doubles', 
    description: 'Two-player mixed gender teams',
    type: LeagueTypeType.DOUBLES, 
    gender: Gender.MIXED,
    isActive: true,
    sortOrder: 5
  },
  // 👇 ADD NEW LEAGUE TYPES HERE 👇
  // { 
  //   name: 'Your Type', 
  //   description: 'Brief description',
  //   type: LeagueTypeType.SINGLES, // or DOUBLES
  //   gender: Gender.MALE, // or FEMALE or MIXED
  //   isActive: true,
  //   sortOrder: 6
  // },
];

// ============================================
// 🌱 SEED FUNCTION
// ============================================

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Seed Sports
    console.log('📊 Seeding sports...');
    for (const sport of SPORTS_LIST) {
      await prisma.sport.upsert({
        where: { name: sport.name },
        update: {
          description: sport.description,
          pic_url: sport.pic_url,
          isActive: sport.isActive,
          sortOrder: sport.sortOrder,
        },
        create: sport,
      });
    }
    console.log(`✅ Seeded ${SPORTS_LIST.length} sports\n`);

    // Seed League Types
    console.log('📊 Seeding league types...');
    for (const leagueType of LEAGUE_TYPES) {
      await prisma.leagueType.upsert({
        where: { name: leagueType.name },
        update: {
          description: leagueType.description,
          type: leagueType.type,
          gender: leagueType.gender,
          isActive: leagueType.isActive,
          sortOrder: leagueType.sortOrder,
        },
        create: leagueType,
      });
    }
    console.log(`✅ Seeded ${LEAGUE_TYPES.length} league types\n`);

    // Optional: Seed test data for development
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 Seeding development test data...');
      
      // You can add test leagues, seasons, users here if needed
      // Example:
      // await prisma.user.upsert({
      //   where: { email: 'admin@test.com' },
      //   update: {},
      //   create: {
      //     email: 'admin@test.com',
      //     name: 'Test Admin',
      //     username: 'admin',
      //     role: 'ADMIN',
      //   },
      // });
      
      console.log('✅ Development data seeded\n');
    }

    console.log('🎉 Database seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
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

