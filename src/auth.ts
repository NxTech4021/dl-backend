import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { createAuthMiddleware, username } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { sendEmail } from "./email";

const prisma = new PrismaClient({ log: ["query", "info", "warn", "error"] });

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [expo(), username()],
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
      // your logic here
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },
  baseURL: "http://localhost:3001", // Accessible through nginx proxy
  trustedOrigins: [
    "http://localhost:82",
    "http://localhost:3001", // Backend's direct port
    "http://localhost:8081",
    "http://192.168.100.48:8081",
    "http://192.168.1.3:8081", // Add the current IP address origin
  ],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID! as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string ,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID! as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET! as string,
    }
  }
});
