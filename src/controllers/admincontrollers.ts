import { PrismaClient, Role } from "@prisma/client";
import { createAdminInvite } from "../services/adminService";
import { inviteEmailTemplate } from "../utils/email";
import { ApiResponse } from "../utils/ApiResponse";
import { sendEmail } from "../config/nodemailer";
import { hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { auth } from "../lib/auth";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const prisma = new PrismaClient();


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
        username,
      },
      include: { accounts: true },
    });

    res.status(201).json({
      message: "Superadmin user created successfully!",
      user: newSuperadmin,
    });
  } catch (error) {
    console.error("Error creating superadmin:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
};

export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json(
          new ApiResponse(false, 400, null, "Email and password are required")
        );
    }

    // Find user with accounts
    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    if (!user || (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN)) {
      return res
        .status(403)
        .json(
          new ApiResponse(false, 403, null, "Sorry you do not have permission")
        );
    }

    // Credentials account
    const account = user.accounts.find(
      (acc) => acc.providerId === "credentials"
    );

    if (!account || !account.password) {
      return res
        .status(400)
        .json(new ApiResponse(false, 401, null, "Invalid credentials No account exists"));
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .json(new ApiResponse(false, 401, null, "Invalid credentials"));
    }

    // Generate JWT including userId and role
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // Send token in cookie + response
    res
      .cookie("accessToken", token, {
        httpOnly: true,
        secure: false, // set to true in production with HTTPS
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })
      .status(200)
      .json(
        new ApiResponse(
          true,
          200,
          {
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            },
          },
          "Login successful"
        )
      );
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json(new ApiResponse(false, 400, null, "Something went wrong"));
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
      createdAt: a.user?.createdAt ?? a.createdAt,
      updatedAt: a.user?.updatedAt,
      type: a.status === "PENDING" ? "PENDING" : "ACTIVE",
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


export const getInviteEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token) return res.status(400).json({ message: "Token is required" });

    // const verification = await prisma.verification.findUnique({
    //   where: { value: token as string },
    // });

    // if (
    //   !verification ||
    //   verification.status !== "PENDING" ||
    //   verification.expiresAt < new Date()
    // ) {
    //   return res.status(400).json({ message: "Invalid or expired token" });
    // }

      const invite = await prisma.adminInviteToken.findUnique({
      where: { token: token as string },
    });

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
      include: {
        admin: {
          include: {
            user: true, 
          },
        },
      },
    });


    console.log("invite data", invite)

    if (!invite || invite.status !== "PENDING") {
      return res
        .status(400)
        .json({ message: "Invalid or already used token", status: "FAILED" });
    }

    if (invite.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ message: "Invite token expired", status: "FAILED" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // const user = await prisma.user.create({
    //   data: {
    //     email,
    //     username,
    //     name,
    //     role: "ADMIN",
    //     accounts: {
    //       create: {
    //         providerId: "credentials",
    //         accountId: email,
    //         password: hashedPassword,
    //       },
    //     },
    //     adminInviteToken: {
    //       connect: { id: invite.id },
    //     },
    //   },
    // });

      const user = await prisma.user.update({
      where: { id: invite.admin.user.id },
      data: {
        name,
        username,
        accounts: {
          create: {
            providerId: "email",
            accountId: invite.email,
            password: hashedPassword,
          },
        },
      },
    });

    
    // update admin status
    await prisma.admin.update({
      where: { id: invite.admin.id },
      data: { status: "ACTIVE" },
    });

    // mark invite as accepted
    await prisma.adminInviteToken.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });

    // expire old invites
    await prisma.adminInviteToken.updateMany({
      where: { status: "PENDING", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });

    res.status(201).json({
      message: "Admin registered successfully",
      status: "SUCCESS",
      user,
    });
  } catch (error: any) {
    if (error.meta?.target?.includes("username")) {
      return res.status(400).json({ message: "Username is already taken" });
    }
    if (error.meta?.target?.includes("email")) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    console.error("Error registering admin:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const sendAdminInvite = async (req: Request, res: Response) => {
  try {
    const { email, name, username } = req.body;
    // const admin = req.user; // Implement after authcontext 

    console.log("Body:", req.body);
    const inviteLink = await createAdminInvite(email, name, username);
    const html = inviteEmailTemplate(inviteLink);

    await sendEmail(email, "You're invited to become an Admin", html);

    res.status(200).json({ message: "Invite sent successfully!" });
  } catch (err) {
    console.error("Error sending invite:", err);
    res.status(400).json({ error: "Failed to send invite." });
  }
};

export const getAdminSession = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res
        .status(401)
        .json(new ApiResponse(false, 401, null, "No session found"));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user || (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN)) {
      return res
        .status(403)
        .json(new ApiResponse(false, 403, null, "Invalid session"));
    }

    res
      .status(200)
      .json(
        new ApiResponse(true, 200, { user }, "Session retrieved successfully")
      );
  } catch (error) {
    console.error("Session error:", error);
    res.status(401).json(new ApiResponse(false, 401, null, "Invalid session"));
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
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminLogout = async (req: Request, res: Response) => {
  try {
    // Clear the access token cookie
    res
      .clearCookie("accessToken", {
        httpOnly: true,
        secure: false, // set to true in production with HTTPS
        sameSite: "lax",
      })
      .status(200)
      .json(new ApiResponse(true, 200, null, "Logout successful"));
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json(new ApiResponse(false, 500, null, "Logout failed"));
  }
};
