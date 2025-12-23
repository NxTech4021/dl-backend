/**
 * Superadmin Seeding Script
 * Creates a superadmin user for dl-admin login
 * Run with: npx tsx prisma/seeds/superadmin.seed.ts
 */

import { PrismaClient, Role, UserStatus, AdminStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SUPERADMIN_CONFIG = {
  name: "Super Admin",
  email: "superadmin@dleague.com",
  username: "superadmin",
  password: "Admin@123",
};

async function seedSuperadmin() {
  console.log("🚀 Starting superadmin seeding...\n");

  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword(SUPERADMIN_CONFIG.password);

  // Check if superadmin already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: SUPERADMIN_CONFIG.email },
    include: { admin: true, accounts: true },
  });

  if (existingUser) {
    console.log("⚠️  Superadmin user already exists!");
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Role: ${existingUser.role}`);
    console.log(`   Admin Status: ${existingUser.admin?.status || "N/A"}`);

    // If user exists but has no admin record, create it
    if (!existingUser.admin) {
      const adminRecord = await prisma.admin.create({
        data: {
          userId: existingUser.id,
          status: AdminStatus.ACTIVE,
        },
      });
      console.log("✅ Created missing Admin record");
    }

    // If user exists but has no account (password), create it
    if (!existingUser.accounts || existingUser.accounts.length === 0) {
      await prisma.account.create({
        data: {
          userId: existingUser.id,
          accountId: existingUser.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
      console.log("✅ Created missing Account record with password");
    }

    // Update role to SUPERADMIN if not already
    if (existingUser.role !== Role.SUPERADMIN) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: Role.SUPERADMIN },
      });
      console.log("✅ Updated role to SUPERADMIN");
    }

    // Ensure admin status is ACTIVE
    if (existingUser.admin && existingUser.admin.status !== AdminStatus.ACTIVE) {
      await prisma.admin.update({
        where: { id: existingUser.admin.id },
        data: { status: AdminStatus.ACTIVE },
      });
      console.log("✅ Updated admin status to ACTIVE");
    }

    console.log("\n✅ Superadmin is ready!");
    console.log("─".repeat(50));
    console.log(`📧 Email:    ${SUPERADMIN_CONFIG.email}`);
    console.log(`🔑 Password: ${SUPERADMIN_CONFIG.password}`);
    console.log("─".repeat(50));
    return;
  }

  // Create new superadmin user
  console.log("Creating superadmin user...");

  const user = await prisma.user.create({
    data: {
      name: SUPERADMIN_CONFIG.name,
      email: SUPERADMIN_CONFIG.email,
      username: SUPERADMIN_CONFIG.username,
      role: Role.SUPERADMIN,
      emailVerified: true,
      completedOnboarding: true,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✅ Created User: ${user.id}`);

  // Create account with password
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  console.log("✅ Created Account with hashed password");

  // Create admin record
  const adminRecord = await prisma.admin.create({
    data: {
      userId: user.id,
      status: AdminStatus.ACTIVE,
    },
  });

  console.log(`✅ Created Admin record: ${adminRecord.id}`);

  console.log("\n🎉 Superadmin created successfully!");
  console.log("─".repeat(50));
  console.log(`📧 Email:    ${SUPERADMIN_CONFIG.email}`);
  console.log(`🔑 Password: ${SUPERADMIN_CONFIG.password}`);
  console.log("─".repeat(50));
}

async function main() {
  try {
    await seedSuperadmin();
  } catch (error) {
    console.error("❌ Error seeding superadmin:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();