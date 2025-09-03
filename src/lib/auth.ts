import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { createAuthMiddleware, emailOTP, username } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { sendEmail } from "../config/nodemailer";
import { getBackendBaseURL, getTrustedOrigins } from "../config/network";

const prisma = new PrismaClient({ log: ["query", "info", "warn", "error"] });

export const auth = betterAuth({
  appName: "DeuceLeague",

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [
    expo(),
    username() as any,
    emailOTP({
      //TODO: Error handling
      async sendVerificationOTP({ email, otp, type }) {
        try {
          let subject = "";
          let html = "";

          if (type === "sign-in") {
            console.log("Sending sign-in email to", email);
            subject = "Your Sign-In Code";
            html = `<p>Your sign-in code is: <strong>${otp}</strong>. It will expire in 10 minutes.</p>`;

          } else if (type === "email-verification") {
            console.log("Sending email verification email to", email);
            subject = "Verify Your Email Address";
            html = `<p>Your email verification code is: <strong>${otp}</strong>. It will expire in 10 minutes.</p>`;

          } else if (type === "forget-password") {
            console.log("Sending forget password email to", email);
            const user = await prisma.user.findUnique({
              where: { email },
            });

            console.log("user", user);

          
            subject = "Your Password Reset Code";
            html = `<p>Your password reset code is: <strong>${otp}</strong>. It will expire in 10 minutes.</p>`;
          }

          if (subject && html) {
            await sendEmail(email, subject, html);
          }

        } catch (error) {
          console.error("Error sending email:", error);
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to send email. Please try again.",
          });
        }
      },
    }),
  ],

  emailAndPassword: {
    enabled: true,
    // requireEmailVerification: true,
  },

  baseURL: process.env.BASE_URL || "http://localhost",

  // OLD: basePath: process.env.BETTER_AUTH_BASE_PATH || "/auth",
  // FIX: Updated to match frontend expectations and app.ts routing
  basePath: process.env.BETTER_AUTH_BASE_PATH || "/api/auth",

  trustedOrigins: [
    "http://localhost:3030",
    "http://localhost:82",
    "http://localhost:3001",
    "http://localhost:8081",
    "http://192.168.1.7:3001",
    "http://192.168.100.53:8081",
    "exp://192.168.100.53:8081",
  ],

  // socialProviders: {
  //   google: {
  //     clientId: process.env.GOOGLE_CLIENT_ID! as string,
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string,
  //   },

  //   facebook: {
  //     clientId: process.env.FACEBOOK_CLIENT_ID! as string,
  //     clientSecret: process.env.FACEBOOK_CLIENT_SECRET! as string,
  //   },
  // },
});
