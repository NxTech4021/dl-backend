import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth";
import crypto from "crypto";

const prisma = new PrismaClient();
const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3030";


export const updateAdminService = async ({
  adminId,   // this is the userId of the admin
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
  // Find the admin record by linked userId
   console.log("🔹 Service received:", { name, username, gender, area }); // 👈 Add this line

  const admin = await prisma.admin.findUnique({
    where: { userId: adminId },
  });

  if (!admin) {
    throw new Error("This user is not an admin");
  }

  // Update the user record
  const updatedUser = await prisma.user.update({
    where: { id: admin.userId },
    data: {
      name: name !== undefined ? name : undefined,
      username: username !== undefined ? username : undefined,
      gender: gender !== undefined ? gender : undefined,
      area: area !== undefined ? area : undefined,
    },
  });

  // Update admin timestamp
  const updatedAdmin = await prisma.admin.update({
    where: { id: admin.id },
    data: { updatedAt: new Date() },
  });

  console.log("User record", updatedUser);

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
