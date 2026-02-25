/**
 * Standalone Admin Seeding Script
 * Run with: npx tsx prisma/seeds/seed-admins.ts
 */

import { PrismaClient, Role, AdminStatus, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface SeededAdmin {
  userId: string;
  adminId: string;
  email: string;
  role: Role;
  status: AdminStatus;
}

async function seedAdmins(): Promise<SeededAdmin[]> {
  console.log("\n👤 Seeding admin users...\n");

  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword("Admin@123");

  const adminData = [
    {
      name: "Super Admin",
      email: "superadmin@dleague.com",
      username: "superadmin",
      role: Role.SUPERADMIN,
      status: AdminStatus.ACTIVE,
    },
    {
      name: "Admin User",
      email: "admin@dleague.com",
      username: "admin",
      role: Role.ADMIN,
      status: AdminStatus.ACTIVE,
    },
    {
      name: "Admin Manager",
      email: "manager@dleague.com",
      username: "manager",
      role: Role.ADMIN,
      status: AdminStatus.ACTIVE,
    },
    {
      name: "Pending Admin",
      email: "pending_admin@dleague.com",
      username: "pending_admin",
      role: Role.ADMIN,
      status: AdminStatus.PENDING,
    },
    {
      name: "Suspended Admin",
      email: "suspended_admin@dleague.com",
      username: "suspended_admin",
      role: Role.ADMIN,
      status: AdminStatus.SUSPENDED,
    },
  ];

  const createdAdmins: SeededAdmin[] = [];

  for (const admin of adminData) {
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email },
      include: { admin: true },
    });

    if (existingUser) {
      if (existingUser.admin) {
        console.log(`   ⏭️  Skipped: ${admin.email} (already exists)`);
        createdAdmins.push({
          userId: existingUser.id,
          adminId: existingUser.admin.id,
          email: admin.email,
          role: admin.role,
          status: admin.status,
        });
      }
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: admin.name,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        emailVerified: true,
        completedOnboarding: true,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
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

    const adminRecord = await prisma.admin.create({
      data: {
        userId: user.id,
        status: admin.status,
      },
    });

    console.log(`   ✅ Created: ${admin.email} (${admin.role}/${admin.status})`);
    createdAdmins.push({
      userId: user.id,
      adminId: adminRecord.id,
      email: admin.email,
      role: admin.role,
      status: admin.status,
    });
  }

  return createdAdmins;
}

async function main() {
  console.log("🚀 Starting admin seeding...");
  console.log("━".repeat(50));

  try {
    const admins = await seedAdmins();

    console.log("\n" + "━".repeat(50));
    console.log(`\n✅ Successfully seeded ${admins.length} admins\n`);
    console.log("📋 Admin Credentials (password: Admin@123):");
    console.log("   - superadmin@dleague.com (SUPERADMIN)");
    console.log("   - admin@dleague.com (ACTIVE)");
    console.log("   - manager@dleague.com (ACTIVE)");
    console.log("   - pending_admin@dleague.com (PENDING)");
    console.log("   - suspended_admin@dleague.com (SUSPENDED)");
    console.log("");
  } catch (error) {
    console.error("\n❌ Error seeding admins:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
