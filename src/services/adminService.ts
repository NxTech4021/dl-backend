import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();
const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3030";


export const createAdminInvite = async (email: string, name: string, username: string) => {
  // generate token
  const token = crypto.randomBytes(8).toString("hex");

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // store verification record
  // await prisma.verification.create({
  //   data: {
  //     identifier: email,
  //     value: token,
  //     status: "PENDING",
  //     expiresAt,
  //   },
  // });

  const admin = await prisma.admin.create({
    data: {
      status: "PENDING",
      user: {
        create: {
          email,
          name,
          username,
          role: "ADMIN",
        },
      },
      invite: {
        create: {
          email,
          token,
          status: "PENDING",
          expiresAt,
        },
      },
    },
    include: { user: true, invite: true },
  });

  console.log("Admin created", admin);


    // return invite link
    return `${BASE_URL}/register/admin?token=${token}`;
};
