import { prisma } from "../../lib/prisma";

/**
 * Business Logic: Update admin profile
 * - Validates admin exists
 * - Updates user record with provided fields
 * - Updates admin timestamp
 *
 * MIGRATED from adminService.ts (updateAdminService)
 */
export const updateAdminProfile = async ({
  adminId,
  name,
  username,
  gender,
  area,
}: {
  adminId: string;
  name?: string;
  username?: string;
  gender?: string;
  area?: string;
}) => {
  // Business Rule: Verify user is an admin
  const admin = await prisma.admin.findUnique({
    where: { userId: adminId },
  });

  if (!admin) {
    throw new Error("This user is not an admin");
  }

  if (!admin.userId) {
    throw new Error("Admin record has no associated user ID");
  }

  // Update user record with only provided fields
  // Build data object only with defined values (not undefined)
  const updateData: {
    name?: string;
    username?: string;
    gender?: string;
    area?: string;
  } = {};

  if (name !== undefined) {
    updateData.name = name;
  }
  if (username !== undefined) {
    updateData.username = username;
  }
  if (gender !== undefined) {
    updateData.gender = gender;
  }
  if (area !== undefined) {
    updateData.area = area;
  }

  const updatedUser = await prisma.user.update({
    where: { id: admin.userId },
    data: updateData,
  });

  // Business Rule: Update admin timestamp
  const updatedAdmin = await prisma.admin.update({
    where: { id: admin.id },
    data: { updatedAt: new Date() },
  });

  return { updatedUser, updatedAdmin };
};

/**
 * Business Logic: Fetch all admins
 * - Retrieves all admin records with user and invite details
 * - Maps to unified frontend format
 * - Handles pending admins (no user yet, only invite)
 *
 * EXTRACTED from fetchAdmins controller
 */
export const fetchAllAdmins = async () => {
  const admins = await prisma.admin.findMany({
    include: {
      user: true,
      invite: true,
    },
  });

  // Business Rule: Map to unified format for frontend
  // - Pending admins: Use invite email, no user data
  // - Active admins: Use user data
  return admins.map((a) => ({
    id: a.user?.id ?? a.id,
    name: a.user?.name ?? a.invite?.email?.split("@")[0] ?? "",
    email: a.user?.email ?? a.invite?.email ?? "",
    role: a.user?.role,
    status: a.status,
    image: a.user?.image,
    displayUsername: a.user?.displayUsername,
    username: a.user?.username,
    dateOfBirth: a.user?.dateOfBirth,
    gender: a.user?.gender,
    area: a.user?.area,
    createdAt: a.createdAt,
    updatedAt: a.user?.updatedAt,
  }));
};

/**
 * Business Logic: Get admin by user ID
 * - Looks up admin record by userId
 * - Includes full user details
 *
 * EXTRACTED from getAdminById controller
 */
export const getAdminByUserId = async (userId: string) => {
  const admin = await prisma.admin.findFirst({
    where: { userId },
    include: { user: true },
  });

  if (!admin) {
    throw new Error("Admin not found");
  }

  return admin;
};
