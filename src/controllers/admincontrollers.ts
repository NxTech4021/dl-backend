import { PrismaClient, Role } from "@prisma/client";
import { createAdminInvite } from "../services/adminService";
import { inviteEmailTemplate } from "../email";
import { ApiResponse } from "../utils/ApiResponse";
import { sendEmail } from "../config/nodemailer";
import { hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const prisma = new PrismaClient();

// export const createSuperadmin = async (req, res) => {

//   try {
//     const { name, username, email } = req.body;

//     // Basic validation to ensure all required fields are present.
//     if (!name || !username || !email) {
//       return res.status(400).json({
//         error: 'Please provide a name, username, and email.',
//       });
//     }

//     // Check if a user with the given email or username already exists
//     // to prevent duplicate entries and maintain data integrity.
//     const existingUser = await prisma.user.findFirst({
//       where: {
//         OR: [
//           { username: username },
//           { email: email }
//         ]
//       },
//     });

//     if (existingUser) {
//       return res.status(409).json({
//         error: 'A user with this username or email already exists.',
//       });
//     }

//     // Use prisma.user.create() to insert a new user record into the database.
//     // We explicitly set the 'role' field to Role.SUPERADMIN using the imported enum.
//     const newSuperadmin = await prisma.user.create({
//       data: {
//         name,
//         username,
//         email,
//         // Assuming a superadmin is immediately verified. You can change this logic.
//         emailVerified: true,
//         // Set the role using the enum provided in the Prisma schema.
//         role: Role.SUPERADMIN,
//       },
//       // You can also select which fields to return in the response.
//       select: {
//         id: true,
//         name: true,
//         username: true,
//         email: true,
//         role: true,
//         createdAt: true,
//       },
//     });

//     // Send a success response with the newly created user data.
//     res.status(201).json({
//       message: 'Superadmin user created successfully!',
//       user: newSuperadmin,
//     });

//   } catch (error) {
//     // Log the full error for debugging purposes on the server side.
//     console.error('Error creating superadmin:', error);

//     // Send a generic 500 status code for internal server errors.
//     res.status(500).json({
//       error: 'An internal server error occurred.',
//     });
//   }
// };


export const createSuperadmin = async (req, res) => {
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

    const hashedPassword = await hash(password, 10);

    // create user + account in one transaction
    const newSuperadmin = await prisma.user.create({
      data: {
        name,
        username,
        email,
        emailVerified: true,
        role: Role.SUPERADMIN,
        accounts: {
          create: {
            providerId: "credentials",
            accountId: email,
            password: hashedPassword,
          },
        },
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


export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json(new ApiResponse(false, 400, null, "Email and password are required"));
    }

    // Find user with accounts
    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });

    if (!user || !["ADMIN", "SUPERADMIN"].includes(user.role)) {
      return res
        .status(400)
        .json(new ApiResponse(false, 401, null, "Sorry you do not have permission"));
    }

    // Credentials account
    const account = user.accounts.find(
      (acc) => acc.providerId === "credentials"
    );

    if (!account || !account.password) {
      return res
        .status(400)
        .json(new ApiResponse(false, 401, null, "Invalid credentials"));
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .json(new ApiResponse(false, 401, null, "Invalid credentials"));
    }

    // Generate JWT including userId and role
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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
        new ApiResponse(true, 200, {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        }, "Login successful")
      );
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json(new ApiResponse(false, 400, null, "Something went wrong"));
  }
};

export const sendAdminInvite = async (req, res) => {
  try {
    const { email } = req.body;
    // const superadmin = req.user; // assumed from auth middleware

    // if (!superadmin || superadmin.role !== Role.SUPERADMIN) {
    //   return res.status(403).json({ error: "Only superadmins can send invites." });
    // }

    const inviteLink = await createAdminInvite(email);
    const html = inviteEmailTemplate(inviteLink);

    await sendEmail(email, "You're invited to become an Admin", html);

    res.status(200).json({ message: "Invite sent successfully!" });
  } catch (err) {
    console.error("Error sending invite:", err);
    res.status(400).json({ error: "Failed to send invite." });
  }
};