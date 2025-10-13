import { PrismaClient, Role } from "@prisma/client";
import { createAdminInvite, resendAdminInvite, updateAdminService } from "../services/adminService";
import { inviteEmailTemplate } from "../utils/email";
import { ApiResponse } from "../utils/ApiResponse";
import { sendEmail } from "../config/nodemailer";
import { Request, Response } from "express";
import { auth } from "../lib/auth";

const prisma = new PrismaClient();

const toWebHeaders = (headers: Request["headers"]): Headers => {
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

export const createSuperadmin = async (req: Request, res: Response) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        error: "Please provide name, username, email, and password.",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "A user with this username or email already exists.",
      });
    }

    // Create a user via BetterAuth so credentials are stored in the expected format
    const signUpResult: any = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        username, // Include username in the signup request
      },
    });

    if (!signUpResult || (signUpResult as any).error) {
      const message = (signUpResult as any)?.error?.message || "Failed to create user via auth";
      return res.status(400).json({ error: message });
    }

    // Promote to SUPERADMIN and mark verified
    const newSuperadmin = await prisma.user.update({
      where: { email },
      data: {
        role: Role.SUPERADMIN,
        emailVerified: true,
      },
      include: { accounts: true },
    });

     const adminRecord = await prisma.admin.create({
      data: {
        userId: newSuperadmin.id,
        status: "ACTIVE",
      },
    });

    res.status(201).json({
      message: "Superadmin user created successfully!",
      user: newSuperadmin,
      admin:adminRecord,
    });
  } catch (error) {
    console.error("Error creating superadmin:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
};

export const fetchAdmins = async (req: Request, res: Response) => {
  try {
   
    const admins = await prisma.admin.findMany({
    include: {
      user: true,       
      invite: true,    
    },
});

    // Then map to a unified frontend format:
    const getAllAdmins = admins.map((a) => ({
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

    // Return combined response
    res.status(200).json(
      new ApiResponse(true, 200, {
      getAllAdmins,
      }, "Admins fetched successfully")
    );
  } catch (error) {
    console.error("Fetch admins error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Something went wrong"));
  }
};

export const updateAdmin = async (req: Request, res: Response) => {
  try {
     console.log("🔹 Incoming updateAdmin request body:", req.body);
    const { adminId, name, username, role, gender, area  } = req.body;

    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
    }

     const { updatedUser, updatedAdmin } = await updateAdminService({
      adminId,
      name,
      username,
      gender,
      area,
    });

    return res.status(200).json({
      message: "Admin updated successfully",
      status: "SUCCESS",
      user: updatedUser,
      admin: updatedAdmin,
    });
  } catch (error: any) {
    console.error("Error updating admin:", error);

    if (error.body?.code === "USERNAME_IS_INVALID") {
      return res.status(400).json({ message: "Invalid username" });
    }
    if (error.body?.code === "USERNAME_ALREADY_EXISTS") {
      return res.status(400).json({ message: "Username already taken" });
    }
    if (error.body?.code === "EMAIL_ALREADY_EXISTS") {
      return res.status(400).json({ message: "Email already registered" });
    }

    return res.status(400).json({ message: error.message || "Something went wrong" });
  }
};

export const getInviteEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    console.log("Token from query:", token);

    if (!token) return res.status(400).json({ message: "Token is required" });
      const invite = await prisma.adminInviteToken.findUnique({
      where: { token: token as string },
    });

    console.log("Invite found:", invite);

    if (
      !invite ||
      invite.status !== "PENDING" ||
      invite.expiresAt < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    res.json({ email: invite.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const { token, name, username, password } = req.body;

    console.log("Incoming body:", req.body);
    if (!token || !name || !username || !password) {
      return res
        .status(400)
        .json({ message: "All fields are required", status: "FAILED" });
    }


   const invite = await prisma.adminInviteToken.findUnique({
      where: { token },
      include: { admin: true },
    });

    if (!invite || invite.status !== "PENDING") {
      return res
        .status(401)
        .json({ message: "Invalid or already used token", status: "FAILED" });
    }

    if (invite.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ message: "Invite token expired", status: "FAILED" });
    }

     // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email is already registered", status: "FAILED" });
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return res
        .status(400)
        .json({ message: "Username is already taken", status: "FAILED" });
    }

    const registeredUser = await auth.api.signUpEmail({
      body: {
        email: invite.email,
        password,
        name,
        username,
      },
    });

    if (!registeredUser?.user) {
      return res
        .status(500)
        .json({ message: "User registration failed", status: "FAILED" });
    }

    const newadmin = registeredUser.user;

    // Update role to ADMIN
    await prisma.user.update({
      where: { id: newadmin.id },
      data: { role: "ADMIN" , emailVerified: true},
    });

    // Update admin status
    await prisma.admin.update({
      where: { id: invite.admin.id },
      data: { status: "ACTIVE", userId: newadmin.id },
    });

    // Mark invite as accepted
    await prisma.adminInviteToken.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });


    res.status(201).json({
      message: "Admin registered successfully",
      status: "SUCCESS",
      newadmin,
    });
  } catch (error: any) {
    if (error.meta?.target?.includes("username")) {
      return res.status(401).json({ message: "Username is already taken" });
    }
    if (error.meta?.target?.includes("email")) {
      return res.status(403).json({ message: "Email is already registered" });
    }

    console.error("Error registering admin:", error);
    res.status(400).json({ message: "Something went wrong" });
  }
};

export const sendAdminInvite = async (req: Request, res: Response) => {
  try {
    const { email, name, adminId } = req.body;

    let inviteLink: string;
    let targetEmail: string;

    if (adminId) {
      // Resend for PENDING admin
      const admin = await prisma.admin.findUnique({
        where: { id: adminId },
        include: { invite: true, user: true },
      });

      if (!admin) {
        return res.status(404).json({ error: "Admin not found." });
      }

      if (admin.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Cannot resend invite to active or suspended admin." });
      }

      targetEmail = admin.user?.email ?? admin.invite?.email!;
      inviteLink = await resendAdminInvite(adminId);
    } else {
      if (!email || !name) {
        return res.status(400).json({ error: "Email and name are required." });
      }

      targetEmail = email;
      inviteLink = await createAdminInvite(email, name);
    }

    // Send email
    const html = inviteEmailTemplate(inviteLink);
    await sendEmail(targetEmail, "You're invited to become an Admin", html);

    res.status(200).json({ message: "Invite sent successfully!", status: "SUCCESS" });
  } catch (err: any) {
    console.error("Error sending invite:", err);
    res.status(400).json({ error: err.message || "Failed to send invite.", status: "FAILED" });
  }
};


export const getAdminSession = async (req: Request, res: Response) => {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "No active session"));
    }

    
    // const user = session.user;

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
    console.log("user", user)

    if (user?.role !== Role.ADMIN && user?.role !== Role.SUPERADMIN) {
      return res
        .status(403)
        .json(new ApiResponse(false, 403, null, "Not authorized"));
    }

    return res.status(200).json(
      new ApiResponse(
        true,
        200,
        { user },
        "Session retrieved successfully"
      )
    );
  } catch (error) {
    console.error("❌ Session error:", error);
    return res
      .status(500)
      .json(new ApiResponse(false, 400, null, "Failed to fetch session"));
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const headers = toWebHeaders(req.headers);

    const session = await auth.api.getSession({ headers });
    if (!session) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "No active session"));
    }

   const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Both old and new password are required"));
    }

    // Will throw if invalid current password
    await auth.api.changePassword({
      body: {
        currentPassword: oldPassword,
        newPassword,
        revokeOtherSessions: false,
      },
      headers,
    });

    return res
      .status(200)
      .json(new ApiResponse(true, 200, null, "Password changed successfully"));
  } catch (error: any) {
    console.error("❌ Change password error:", error);

    // Better Auth usually throws an Error with message
    return res
      .status(400)
      .json(new ApiResponse(false, 400, null, error?.message || "Password change failed"));
  }
};

export const getAdminById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const admin = await prisma.admin.findFirst({
      where: { userId: id as string },  
      include: { user: true },
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    return res.json(admin);
  } catch (error) {
    console.error("Error fetching admin:", error);
    return res.status(400).json({ message: "Internal server error" });
  }
};

