import { prisma } from "../../lib/prisma";
import { auth } from "../../lib/auth";
import { Role } from "@prisma/client";

/**
 * Business Logic: Create a superadmin user
 * - Validates required fields
 * - Checks for existing user with username/email
 * - Creates user via BetterAuth
 * - Promotes to SUPERADMIN role
 * - Marks email as verified
 * - Creates Admin record with ACTIVE status
 */
export const createSuperadmin = async (data: {
  name: string;
  username: string;
  email: string;
  password: string;
}) => {
  const { name, username, email, password } = data;

  // Business Rule: Check for existing user
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (existingUser) {
    throw new Error("A user with this username or email already exists.");
  }

  // Create user via BetterAuth so credentials are stored correctly
  const signUpResult: any = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
      username,
    } as any,
  });

  if (!signUpResult || (signUpResult).error) {
    const message =
      (signUpResult)?.error?.message || "Failed to create user via auth";
    throw new Error(message);
  }

  // Business Rule: Promote to SUPERADMIN role and mark email verified
  const newSuperadmin = await prisma.user.update({
    where: { email },
    data: {
      role: Role.SUPERADMIN,
      emailVerified: true,
    },
    include: { accounts: true },
  });

  // Business Rule: Create Admin record with ACTIVE status
  const adminRecord = await prisma.admin.create({
    data: {
      userId: newSuperadmin.id,
      status: "ACTIVE",
    },
  });

  return { user: newSuperadmin, admin: adminRecord };
};
