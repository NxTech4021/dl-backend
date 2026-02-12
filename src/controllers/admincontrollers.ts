import { prisma } from "../lib/prisma";
import * as superadminService from "../services/admin/superadminService";
import * as adminInviteService from "../services/admin/adminInviteService";
import * as adminRegistrationService from "../services/admin/adminRegistrationService";
import * as adminProfileService from "../services/admin/adminProfileService";
import * as adminSessionService from "../services/admin/adminSessionService";
import { sendSuccess, sendError } from "../utils/response";
import { Request, Response } from "express";

interface CreateSuperadminBody {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
}

export const createSuperadmin = async (req: Request, res: Response) => {
  try {
    const { name, username, email, password } =
      req.body as CreateSuperadminBody;

    console.log("ASDAS");

    if (!name || !username || !email || !password) {
      return sendError(res, "Please provide name, username, email, and password.", 400);
    }

    const result = await superadminService.createSuperadmin({
      name,
      username,
      email,
      password,
    });

    return sendSuccess(res, { user: result.user, admin: result.admin }, "Superadmin user created successfully!", 201);
  } catch (error: unknown) {
    console.error("Error creating superadmin:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An internal server error occurred.";
    const status = errorMessage.includes("already exists") ? 409 : 500;
    return sendError(res, errorMessage, status);
  }
};

export const fetchAdmins = async (req: Request, res: Response) => {
  try {
    const getAllAdmins = await adminProfileService.fetchAllAdmins();

    return sendSuccess(res, { getAllAdmins }, "Admins fetched successfully");
  } catch (error) {
    console.error("Fetch admins error:", error);
    return sendError(res, "Something went wrong", 500);
  }
};

interface UpdateAdminBody {
  adminId?: string;
  name?: string;
  username?: string;
  role?: string;
  gender?: string;
  area?: string;
}

export const updateAdmin = async (req: Request, res: Response) => {
  try {
    console.log("🔹 Incoming updateAdmin request body:", req.body);
    const { adminId, name, username, gender, area } =
      req.body as UpdateAdminBody;

    if (!adminId) {
      return sendError(res, "Admin ID is required", 400);
    }

    const updatePayload: {
      adminId: string;
      name?: string;
      username?: string;
      gender?: string;
      area?: string;
    } = { adminId };

    if (name !== undefined) {
      updatePayload.name = name;
    }
    if (username !== undefined) {
      updatePayload.username = username;
    }
    if (gender !== undefined) {
      updatePayload.gender = gender;
    }
    if (area !== undefined) {
      updatePayload.area = area;
    }

    const { updatedUser, updatedAdmin } =
      await adminProfileService.updateAdminProfile(updatePayload);

    return sendSuccess(res, { user: updatedUser, admin: updatedAdmin }, "Admin updated successfully");
  } catch (error: unknown) {
    console.error("Error updating admin:", error);

    if (error && typeof error === "object" && "body" in error) {
      const errorBody = error.body as { code?: string };
      if (errorBody.code === "USERNAME_IS_INVALID") {
        return sendError(res, "Invalid username", 400);
      }
      if (errorBody.code === "USERNAME_ALREADY_EXISTS") {
        return sendError(res, "Username already taken", 400);
      }
      if (errorBody.code === "EMAIL_ALREADY_EXISTS") {
        return sendError(res, "Email already registered", 400);
      }
    }

    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";
    return sendError(res, errorMessage, 400);
  }
};

export const getInviteEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token) {
      return sendError(res, "Token is required", 400);
    }

    const result = await adminInviteService.validateInviteToken(
      token as string
    );
    return sendSuccess(res, { email: result.email });
  } catch (err: unknown) {
    console.error(err);
    const errorMessage =
      err instanceof Error ? err.message : "Something went wrong";
    return sendError(res, errorMessage, 400);
  }
};

interface RegisterAdminBody {
  token?: string;
  name?: string;
  username?: string;
  password?: string;
}

export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const { token, name, username, password } = req.body as RegisterAdminBody;

    if (!token || !name || !username || !password) {
      return sendError(res, "All fields are required", 400);
    }

    const result = await adminRegistrationService.registerAdminFromInvite({
      token,
      name,
      username,
      password,
    });

    return sendSuccess(res, { newadmin: result.admin }, "Admin registered successfully", 201);
  } catch (error: unknown) {
    console.error("Error registering admin:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Something went wrong";

    // Map specific errors to appropriate status codes
    if (errorMessage.includes("already used")) {
      return sendError(res, errorMessage, 401);
    }
    if (errorMessage.includes("expired")) {
      return sendError(res, errorMessage, 400);
    }
    if (errorMessage.includes("already registered")) {
      return sendError(res, errorMessage, 400);
    }
    if (errorMessage.includes("already taken")) {
      return sendError(res, errorMessage, 400);
    }

    return sendError(res, "Something went wrong", 400);
  }
};

interface SendAdminInviteBody {
  email?: string;
  name?: string;
  adminId?: string;
}

export const sendAdminInvite = async (req: Request, res: Response) => {
  try {
    const { email, name, adminId } = req.body as SendAdminInviteBody;

    let inviteLink: string;
    let targetEmail: string;

    if (adminId) {
      // Resend for PENDING admin
      const admin = await prisma.admin.findUnique({
        where: { id: adminId },
        include: { invite: true, user: true },
      });

      if (!admin) {
        return sendError(res, "Admin not found.", 404);
      }

      if (admin.status !== "PENDING") {
        return sendError(res, "Cannot resend invite to active or suspended admin.", 400);
      }

      targetEmail = admin.user?.email ?? admin.invite?.email ?? "";
      if (!targetEmail) {
        return sendError(res, "Admin email not found.", 400);
      }
      inviteLink = await adminInviteService.resendAdminInvite(adminId);
    } else {
      if (!email || !name) {
        return sendError(res, "Email and name are required.", 400);
      }

      targetEmail = email;
      inviteLink = await adminInviteService.createAdminInvite(email, name);
    }

    // Send email
    await adminInviteService.sendInviteEmail(
      targetEmail,
      inviteLink,
      !!adminId
    );

    return sendSuccess(res, null, "Invite sent successfully!");
  } catch (err: unknown) {
    console.error("Error sending invite:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to send invite.";
    return sendError(res, errorMessage, 400);
  }
};

export const getAdminSession = async (req: Request, res: Response) => {
  try {
    const headers = adminSessionService.toWebHeaders(req.headers);
    const result = await adminSessionService.getAdminSession(headers);

    return sendSuccess(res, result, "Session retrieved successfully");
  } catch (error: unknown) {
    console.error("❌ Session error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch session";
    const status =
      errorMessage === "No active session"
        ? 401
        : errorMessage === "Not authorized"
        ? 403
        : 500;

    return sendError(res, errorMessage, status);
  }
};

interface UpdatePasswordBody {
  oldPassword?: string;
  newPassword?: string;
}

export const updatePassword = async (req: Request, res: Response) => {
  try {
    const headers = adminSessionService.toWebHeaders(req.headers);
    const { oldPassword, newPassword } = req.body as UpdatePasswordBody;

    if (!oldPassword || !newPassword) {
      return sendError(res, "Both old and new password are required", 400);
    }

    await adminSessionService.updateAdminPassword(
      headers,
      oldPassword,
      newPassword
    );

    return sendSuccess(res, null, "Password changed successfully");
  } catch (error: unknown) {
    console.error("❌ Change password error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Password change failed";
    return sendError(res, errorMessage, 400);
  }
};

export const getAdminById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return sendError(res, "Admin ID is required", 400);
    }

    const admin = await adminProfileService.getAdminByUserId(id);
    return sendSuccess(res, admin);
  } catch (error: unknown) {
    console.error("Error fetching admin:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const status = errorMessage === "Admin not found" ? 404 : 500;
    return sendError(res, errorMessage, status);
  }
};

export const trackLogin = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return sendError(res, "Missing userId", 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLogin: new Date(),
        lastActivityCheck: new Date(),
      },
    });

    return sendSuccess(res, null);
  } catch (err) {
    console.error("Failed updating login time:", err);
    return sendError(res, "Server error", 500);
  }
};
