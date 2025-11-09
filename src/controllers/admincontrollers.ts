import { prisma } from "../lib/prisma";
import * as superadminService from "../services/admin/superadminService";
import * as adminInviteService from "../services/admin/adminInviteService";
import * as adminRegistrationService from "../services/admin/adminRegistrationService";
import * as adminProfileService from "../services/admin/adminProfileService";
import * as adminSessionService from "../services/admin/adminSessionService";
import { ApiResponse } from "../utils/ApiResponse";
import { Request, Response } from "express";


interface CreateSuperadminBody {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
}

export const createSuperadmin = async (req: Request, res: Response) => {
  try {
    const { name, username, email, password } = req.body as CreateSuperadminBody;

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
  } catch (error: unknown) {
    console.error("Error creating superadmin:", error);
    const errorMessage = error instanceof Error ? error.message : "An internal server error occurred.";
    const status = errorMessage.includes("already exists") ? 409 : 500;
    res.status(status).json({
      error: errorMessage
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
    const { adminId, name, username, gender, area  } = req.body as UpdateAdminBody;

    if (!adminId) {
      return res.status(400).json({ message: "Admin ID is required" });
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

     const { updatedUser, updatedAdmin } = await adminProfileService.updateAdminProfile(updatePayload);

    return res.status(200).json({
      message: "Admin updated successfully",
      status: "SUCCESS",
      user: updatedUser,
      admin: updatedAdmin,
    });
  } catch (error: unknown) {
    console.error("Error updating admin:", error);

    if (error && typeof error === 'object' && 'body' in error) {
      const errorBody = error.body as { code?: string };
      if (errorBody.code === "USERNAME_IS_INVALID") {
        return res.status(400).json({ message: "Invalid username" });
      }
      if (errorBody.code === "USERNAME_ALREADY_EXISTS") {
        return res.status(400).json({ message: "Username already taken" });
      }
      if (errorBody.code === "EMAIL_ALREADY_EXISTS") {
        return res.status(400).json({ message: "Email already registered" });
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Something went wrong";
    return res.status(400).json({ message: errorMessage });
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
  } catch (err: unknown) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : "Something went wrong";
    res.status(400).json({ message: errorMessage });
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
  } catch (error: unknown) {
    console.error("Error registering admin:", error);

    const errorMessage = error instanceof Error ? error.message : "Something went wrong";

    // Map specific errors to appropriate status codes
    if (errorMessage.includes("already used")) {
      return res.status(401).json({ message: errorMessage, status: "FAILED" });
    }
    if (errorMessage.includes("expired")) {
      return res.status(400).json({ message: errorMessage, status: "FAILED" });
    }
    if (errorMessage.includes("already registered")) {
      return res.status(400).json({ message: errorMessage, status: "FAILED" });
    }
    if (errorMessage.includes("already taken")) {
      return res.status(400).json({ message: errorMessage, status: "FAILED" });
    }

    res.status(400).json({ message: "Something went wrong", status: "FAILED" });
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
        return res.status(404).json({ error: "Admin not found." });
      }

      if (admin.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "Cannot resend invite to active or suspended admin." });
      }

      targetEmail = admin.user?.email ?? admin.invite?.email ?? '';
      if (!targetEmail) {
        return res.status(400).json({ error: "Admin email not found." });
      }
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
  } catch (err: unknown) {
    console.error("Error sending invite:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to send invite.";
    res.status(400).json({ error: errorMessage, status: "FAILED" });
  }
};


export const getAdminSession = async (req: Request, res: Response) => {
  try {
    const headers = adminSessionService.toWebHeaders(req.headers);
    const result = await adminSessionService.getAdminSession(headers);

    return res.status(200).json(
      new ApiResponse(true, 200, result, "Session retrieved successfully")
    );
  } catch (error: unknown) {
    console.error("❌ Session error:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to fetch session";
    const status = errorMessage === "No active session" ? 401 :
                   errorMessage === "Not authorized" ? 403 : 500;

    return res.status(status).json(
      new ApiResponse(false, status, null, errorMessage)
    );
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
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Both old and new password are required"));
    }

    await adminSessionService.updateAdminPassword(headers, oldPassword, newPassword);

    return res
      .status(200)
      .json(new ApiResponse(true, 200, null, "Password changed successfully"));
  } catch (error: unknown) {
    console.error("❌ Change password error:", error);
    const errorMessage = error instanceof Error ? error.message : "Password change failed";
    return res
      .status(400)
      .json(new ApiResponse(false, 400, null, errorMessage));
  }
};

export const getAdminById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        message: "Admin ID is required"
      });
    }
    
    const admin = await adminProfileService.getAdminByUserId(id);
    return res.json(admin);
  } catch (error: unknown) {
    console.error("Error fetching admin:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const status = errorMessage === "Admin not found" ? 404 : 500;
    return res.status(status).json({
      message: errorMessage
    });
  }
};


export const trackLogin = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLogin: new Date(),
        lastActivityCheck: new Date(),
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Failed updating login time:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
