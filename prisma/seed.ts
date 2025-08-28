import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      name: 'Test User',
      gender: 'male',
      birthDate: new Date('1990-01-01'),
      email: 'test@example.com',
      location: {
        create: {
          country: 'United States',
          state: 'California',
          city: 'San Francisco',
          latitude: 37.7749 as any,
          longitude: -122.4194 as any,
        }
      }
    },
  });

  // Create test admin
  const testAdmin = await prisma.admin.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: 'admin123', // In production, this should be hashed
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('Test User:', testUser);
  console.log('Test Admin:', testAdmin);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    (globalThis as any).process?.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
