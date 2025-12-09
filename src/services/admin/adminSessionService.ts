import { prisma } from "../../lib/prisma";
import { auth } from "../../lib/auth";
import { Role } from "@prisma/client";
import { Request } from "express";

/**
 * Utility: Convert Express headers to Web API Headers
 * - Handles undefined values
 * - Handles array values (joins with comma)
 * - Converts all to strings
 */
export const toWebHeaders = (headers: Request["headers"]): Headers => {
  const webHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      webHeaders.set(key, value.join(","));
    } else {
      webHeaders.set(key, String(value));
    }
  }
  return webHeaders;
};

/**
 * Business Logic: Get admin session with full user details
 * - Validates session exists via Better-Auth
 * - Fetches full user record from database
 * - Validates user has ADMIN or SUPERADMIN role
 *
 * EXTRACTED from getAdminSession controller
 */
export const getAdminSession = async (headers: Headers) => {
  // Business Rule: Validate session via Better-Auth
  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw new Error("No active session");
  }

  // Business Rule: Fetch full user details from database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      displayUsername: true,
      role: true,
      lastLogin: true,
      lastActivityCheck: true,
      area: true,
      gender: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Business Rule: Validate user is admin or superadmin
  if (!user || (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN)) {
    throw new Error("Not authorized");
  }

  // Fetch admin record to get admin ID
  const admin = await prisma.admin.findFirst({
    where: { userId: user.id },
    select: {
      id: true,
      status: true,
    },
  });

  return { user, admin };
};

/**
 * Business Logic: Update admin password
 * - Validates session exists
 * - Validates current password (via Better-Auth)
 * - Updates to new password
 * - Does NOT revoke other sessions (allows concurrent sessions)
 *
 * EXTRACTED from updatePassword controller
 */
export const updateAdminPassword = async (
  headers: Headers,
  oldPassword: string,
  newPassword: string
) => {
  // Business Rule: Validate session via Better-Auth
  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw new Error("No active session");
  }

  // Business Rule: Change password (Better-Auth validates current password)
  // Will throw error if current password is incorrect
  await auth.api.changePassword({
    body: {
      currentPassword: oldPassword,
      newPassword,
      revokeOtherSessions: false, // Allow concurrent sessions
    },
    headers,
  });

  return { success: true };
};
