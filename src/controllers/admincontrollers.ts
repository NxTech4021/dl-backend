import { prisma } from "../lib/prisma";
import { PrismaClient, Role } from "@prisma/client";
import * as superadminService from "../services/admin/superadminService";
import * as adminInviteService from "../services/admin/adminInviteService";
import * as adminRegistrationService from "../services/admin/adminRegistrationService";
import * as adminProfileService from "../services/admin/adminProfileService";
import * as adminSessionService from "../services/admin/adminSessionService";
import { inviteEmailTemplate } from "../utils/email";
import { ApiResponse } from "../utils/ApiResponse";
import { sendEmail } from "../config/nodemailer";
import { Request, Response } from "express";
import { auth } from "../lib/auth";


export const createSuperadmin = async (req: Request, res: Response) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        error: "Please provide name, username, email, and password.",
      });
    }

    const result = await superadminService.createSuperadmin({
      name,
      username,
      email,
      password,
    });

    res.status(201).json({
      message: "Superadmin user created successfully!",
      user: result.user,
      admin: result.admin,
    });
  } catch (error: any) {
    console.error("Error creating superadmin:", error);
    const status = error.message.includes("already exists") ? 409 : 500;
    res.status(status).json({
      error: error.message || "An internal server error occurred."
    });
  }
};

export const fetchAdmins = async (req: Request, res: Response) => {
  try {
    const getAllAdmins = await adminProfileService.fetchAllAdmins();

    res.status(200).json(
      new ApiResponse(true, 200, { getAllAdmins }, "Admins fetched successfully")
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

     const { updatedUser, updatedAdmin } = await adminProfileService.updateAdminProfile({
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

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const result = await adminInviteService.validateInviteToken(token as string);
    res.json({ email: result.email });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ message: err.message || "Something went wrong" });
  }
};

export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const { token, name, username, password } = req.body;

    if (!token || !name || !username || !password) {
      return res
        .status(400)
        .json({ message: "All fields are required", status: "FAILED" });
    }

    const result = await adminRegistrationService.registerAdminFromInvite({
      token,
      name,
      username,
      password,
    });

    res.status(201).json({
      message: "Admin registered successfully",
      status: "SUCCESS",
      newadmin: result.admin,
    });
  } catch (error: any) {
    console.error("Error registering admin:", error);

    // Map specific errors to appropriate status codes
    if (error.message.includes("already used")) {
      return res.status(401).json({ message: error.message, status: "FAILED" });
    }
    if (error.message.includes("expired")) {
      return res.status(400).json({ message: error.message, status: "FAILED" });
    }
    if (error.message.includes("already registered")) {
      return res.status(400).json({ message: error.message, status: "FAILED" });
    }
    if (error.message.includes("already taken")) {
      return res.status(400).json({ message: error.message, status: "FAILED" });
    }

    res.status(400).json({ message: "Something went wrong", status: "FAILED" });
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
      inviteLink = await adminInviteService.resendAdminInvite(adminId);
    } else {
      if (!email || !name) {
        return res.status(400).json({ error: "Email and name are required." });
      }

      targetEmail = email;
      inviteLink = await adminInviteService.createAdminInvite(email, name);
    }

    // Send email
    await adminInviteService.sendInviteEmail(targetEmail, inviteLink, !!adminId);

    res.status(200).json({ message: "Invite sent successfully!", status: "SUCCESS" });
  } catch (err: any) {
    console.error("Error sending invite:", err);
    res.status(400).json({ error: err.message || "Failed to send invite.", status: "FAILED" });
  }
};


export const getAdminSession = async (req: Request, res: Response) => {
  try {
    const headers = adminSessionService.toWebHeaders(req.headers);
    const result = await adminSessionService.getAdminSession(headers);

    return res.status(200).json(
      new ApiResponse(true, 200, result, "Session retrieved successfully")
    );
  } catch (error: any) {
    console.error("❌ Session error:", error);

    const status = error.message === "No active session" ? 401 :
                   error.message === "Not authorized" ? 403 : 500;

    return res.status(status).json(
      new ApiResponse(false, status, null, error.message || "Failed to fetch session")
    );
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const headers = adminSessionService.toWebHeaders(req.headers);
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Both old and new password are required"));
    }

    await adminSessionService.updateAdminPassword(headers, oldPassword, newPassword);

    return res
      .status(200)
      .json(new ApiResponse(true, 200, null, "Password changed successfully"));
  } catch (error: any) {
    console.error("❌ Change password error:", error);
    return res
      .status(400)
      .json(new ApiResponse(false, 400, null, error?.message || "Password change failed"));
  }
};

export const getAdminById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const admin = await adminProfileService.getAdminByUserId(id);
    return res.json(admin);
  } catch (error: any) {
    console.error("Error fetching admin:", error);
    const status = error.message === "Admin not found" ? 404 : 500;
    return res.status(status).json({
      message: error.message || "Internal server error"
    });
  }
};

