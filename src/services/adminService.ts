import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || "http://localhost:82";


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

   console.log("🔹 Service received:", { name, username, gender, area }); 

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

// export const createAdminInvite = async (email: string, name: string) => {
//   // generate token
//   const token = crypto.randomBytes(8).toString("hex");

//   const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Days 

//  const admin = await prisma.admin.create({
//   data: {
//     status: "PENDING",
//     invite: {
//       create: {
//         email,
//         token,
//         status: "PENDING",
//         expiresAt,
//       },
//     },
//   },
//   include: { invite: true },
// });

// console.log("✅ Admin + Invite created:", admin);


//     // return invite link
//     return `${BASE_URL}/register/admin?token=${token}`;
// };

export const createAdminInvite = async (email: string, name: string) => {
  // Check if email already has a PENDING admin
  const existingAdmin = await prisma.admin.findFirst({
    where: {
      OR: [
        { user: { email } },      
        { invite: { email } },    
      ],
    },
    include: { invite: true, user: true },
  });

  if (existingAdmin) {
    throw new Error("This email already has a pending or active admin");
  }

  const token = crypto.randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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

  return `${BASE_URL}/register/admin?token=${token}`;
};

export const resendAdminInvite = async (adminId: string) => {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { invite: true, user: true },
  });

  if (!admin) throw new Error("Admin not found");
  if (admin.status !== "PENDING") throw new Error("Cannot resend invite to active or suspended admin");

  // Generate new token and update invite
  const token = crypto.randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.adminInviteToken.update({
    where: { id: admin.invite!.id },
    data: { token, expiresAt, status: "PENDING" },
  });

  const targetEmail = admin.user?.email ?? admin.invite?.email!;
  return `${BASE_URL}/register/admin?token=${token}`;
};
