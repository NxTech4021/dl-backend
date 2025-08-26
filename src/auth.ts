import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { createAuthMiddleware } from "better-auth/plugins";

const prisma = new PrismaClient({  log: ['query', 'info', 'warn', 'error'],});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      console.log("Sending verification email to:", user.email);
      console.log("Verification URL:", url);
      console.log("Verification token:", token);
      console.log("Request:", request);
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        text: `Click the link to verify your email: ${url}`,
      });
    },
  },
  baseURL: "http://localhost:82", // Accessible through nginx proxy
  trustedOrigins: [
    "http://localhost:82",         // Your NGINX proxy origin
    "http://localhost:3001",       // The backend's own origin (sometimes needed)
    "http://localhost:8081",       // The Expo Metro server (local)
    "http://192.168.0.3:8081",   // The Expo Metro server (network)
    "deuceleague://",   
  ],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID! as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID! as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET! as string,

    }
  }
});
