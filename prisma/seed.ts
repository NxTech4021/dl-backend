import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Seed admin user
    console.log('👤 Seeding admin user...');
    const { hashPassword } = await import('better-auth/crypto');

    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@dleague.com' },
    });

    if (!existingAdmin) {
      const adminUser = await prisma.user.create({
        data: {
          name: 'Admin User',
          email: 'admin@dleague.com',
          username: 'admin',
          role: 'ADMIN',
          emailVerified: true,
        },
      });

      const hashedPassword = await hashPassword('Admin@123');

      await prisma.account.create({
        data: {
          userId: adminUser.id,
          accountId: adminUser.id,
          providerId: 'credential',
          password: hashedPassword,
        },
      });

      await prisma.admin.create({
        data: {
          userId: adminUser.id,
          status: 'ACTIVE',
        },
      });

      console.log('✅ Admin user created:');
      console.log('   Email: admin@dleague.com');
      console.log('   Password: Admin@123\n');
    } else {
      console.log('ℹ️  Admin user already exists\n');
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
