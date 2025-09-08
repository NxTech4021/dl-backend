import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth";
import crypto from "crypto";

const prisma = new PrismaClient();
const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3030";


export const updateAdminService = async ({
  adminId,
  name,
  username,
  role,
}: {
  adminId: string;
  name?: string;
  username?: string;
  role?: string;
}) => {

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || !admin.userId) {
    throw new Error("Admin not found or not linked to a user");
  }

  // ✅ update user in Better Auth
  const updatedUser = await auth.api.users.updateUser({
    userId: admin.userId,
    data: {
      ...(name && { name }),
      ...(username && { username }),
      ...(role && { role }),
    },
  });

  const updatedAdmin = await prisma.admin.update({
    where: { id: adminId },
    data: {
      updatedAt: new Date(),
    },
  });

  return { updatedUser, updatedAdmin };
};

export const createAdminInvite = async (email: string, name: string) => {
  // generate token
  const token = crypto.randomBytes(8).toString("hex");

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

 const admin = await prisma.admin.create({
  data: {
    status: "PENDING",
    invite: {
      create: {
        email,
        token,
        status: "PENDING",
        expiresAt,
      },
    },
  },
  include: { invite: true },
});

console.log("✅ Admin + Invite created:", admin);


    // return invite link
    return `${BASE_URL}/register/admin?token=${token}`;
};
