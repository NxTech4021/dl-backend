import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { createAuthMiddleware, username } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { sendEmail } from "../utils/email";

const prisma = new PrismaClient({ log: ["query", "info", "warn", "error"] });

export const auth = betterAuth({
  appName: "DeuceLeague",

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  plugins: [expo(), username() as any],

  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Click the link to reset your password: ${url}`,
      });
    },
    onPasswordReset: async ({ user }, request) => {
      console.log(`Password for user ${user.email} has been reset.`);
    },
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
