import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../config/nodemailer";
import { inviteEmailTemplate } from "../../utils/email";
import crypto from "crypto";

const BASE_URL = process.env.BASE_URL || "http://localhost:82";

/**
 * Business Logic: Create admin invite
 * - Checks if email already has pending/active admin
 * - Generates unique token
 * - Creates Admin record with PENDING status
 * - Creates AdminInviteToken record
 * - Returns invite link
 *
 * MIGRATED from adminService.ts
 */
export const createAdminInvite = async (email: string, name: string) => {
  // Business Rule: Check if email already has a PENDING or ACTIVE admin
  const existingAdmin = await prisma.admin.findFirst({
    where: {
      OR: [{ user: { email } }, { invite: { email } }],
    },
    include: { invite: true, user: true },
  });

  if (existingAdmin) {
    throw new Error("This email already has a pending or active admin");
  }

  // Generate token (30-day expiration)
  const token = crypto.randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Business Rule: Create Admin + Invite in single transaction
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

/**
 * Business Logic: Resend admin invite
 * - Validates admin exists and is PENDING
 * - Generates new token
 * - Updates existing invite record
 * - Returns new invite link
 *
 * MIGRATED from adminService.ts
 */
export const resendAdminInvite = async (adminId: string) => {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { invite: true, user: true },
  });

  if (!admin) throw new Error("Admin not found");

  // Business Rule: Can only resend to PENDING admins
  if (admin.status !== "PENDING") {
    throw new Error("Cannot resend invite to active or suspended admin");
  }

  // Generate new token (30-day expiration)
  const token = crypto.randomBytes(8).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Business Rule: Update existing invite token
  await prisma.adminInviteToken.update({
    where: { id: admin.invite!.id },
    data: { token, expiresAt, status: "PENDING" },
  });

  return `${BASE_URL}/register/admin?token=${token}`;
};

/**
 * Business Logic: Validate invite token
 * - Checks token exists
 * - Validates status is PENDING
 * - Checks token hasn't expired
 * - Returns email for registration
 *
 * EXTRACTED from getInviteEmail controller
 */
export const validateInviteToken = async (token: string) => {
  const invite = await prisma.adminInviteToken.findUnique({
    where: { token },
  });

  if (!invite) {
    throw new Error("Invalid token");
  }

  // Business Rule: Token must be PENDING
  if (invite.status !== "PENDING") {
    throw new Error("Token already used");
  }

  // Business Rule: Token must not be expired
  if (invite.expiresAt < new Date()) {
    throw new Error("Token expired");
  }

  return { email: invite.email };
};

/**
 * Business Logic: Send invite email
 * - Formats email with template
 * - Sends via nodemailer
 * - Different subject for resend vs new invite
 *
 * EXTRACTED from sendAdminInvite controller
 */
export const sendInviteEmail = async (
  email: string,
  inviteLink: string,
  isResend = false
) => {
  const html = inviteEmailTemplate(inviteLink);
  const subject = isResend
    ? "Reminder: You're invited to become an Admin"
    : "You're invited to become an Admin";

  await sendEmail(email, subject, html);
};
