import { prisma } from "../../lib/prisma";
import { auth } from "../../lib/auth";

/**
 * Business Logic: Register admin from invite token
 * - Validates token exists and is PENDING
 * - Checks token expiration
 * - Validates email and username availability
 * - Creates user via BetterAuth
 * - Promotes to ADMIN role
 * - Marks email as verified
 * - Updates Admin record (PENDING ’ ACTIVE, links userId)
 * - Marks invite token as ACCEPTED
 *
 * EXTRACTED from registerAdmin controller
 */
export const registerAdminFromInvite = async (data: {
  token: string;
  name: string;
  username: string;
  password: string;
}) => {
  const { token, name, username, password } = data;

  // Business Rule: Fetch invite with admin relation
  const invite = await prisma.adminInviteToken.findUnique({
    where: { token },
    include: { admin: true },
  });

  if (!invite || invite.status !== "PENDING") {
    throw new Error("Invalid or already used token");
  }

  // Business Rule: Token must not be expired
  if (invite.expiresAt < new Date()) {
    throw new Error("Invite token expired");
  }

  // Business Rule: Email must not already be registered
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (existingUser) {
    throw new Error("Email is already registered");
  }

  // Business Rule: Username must be available
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUsername) {
    throw new Error("Username is already taken");
  }

  // Register user via BetterAuth
  const registeredUser = await auth.api.signUpEmail({
    body: {
      email: invite.email,
      password,
      name,
      username,
    } as any,
  });

  if (!registeredUser?.user) {
    throw new Error("User registration failed");
  }

  const newAdmin = registeredUser.user;

  // Business Rule: Promote to ADMIN role and mark email verified
  await prisma.user.update({
    where: { id: newAdmin.id },
    data: { role: "ADMIN", emailVerified: true },
  });

  // Business Rule: Update Admin status to ACTIVE and link userId
  await prisma.admin.update({
    where: { id: invite.admin.id },
    data: { status: "ACTIVE", userId: newAdmin.id },
  });

  // Business Rule: Mark invite token as ACCEPTED
  await prisma.adminInviteToken.update({
    where: { id: invite.id },
    data: { status: "ACCEPTED" },
  });

  return { admin: newAdmin };
};
