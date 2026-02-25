/// <reference types="node" />
import { PrismaClient, Role, AdminStatus, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface SeededAdmin {
  userId: string;
  adminId: string;
}

async function seedAdmins(): Promise<SeededAdmin[]> {
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
    // check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email },
      include: { admin: true },
    });

    if (existingUser) {
      if (existingUser.admin) {
        createdAdmins.push({
          userId: existingUser.id,
          adminId: existingUser.admin.id,
        });
      }
      continue; // skip if already exists
    }

    // create user
    const user = await prisma.user.create({
      data: {
        name: admin.name,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        emailVerified: true,
        completedOnboarding: true,
        status: UserStatus.ACTIVE,
      },
    });

    // create account with hashed password
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });

    // create admin record
    const adminRecord = await prisma.admin.create({
      data: {
        userId: user.id,
        status: admin.status,
      },
    });

    createdAdmins.push({ userId: user.id, adminId: adminRecord.id });
  }

  return createdAdmins;
}

// Run the seed
seedAdmins()
  .then((admins) => {
    console.log("✅ Seeded admins:", admins);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed to seed admins:", err);
    process.exit(1);
  });

