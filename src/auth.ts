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
  },
  
  // trustedOrigins: [
  //   "http://localhost:82",
  //   "http://localhost:3001" // It's good practice to add the backend's own origin
  // ],
  
  // socialProviders: {
  //   google: {
  //     clientId: process.env.GOOGLE_CLIENT_ID!,
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  //   },
  //   facebook: {
  //     clientId: process.env.FACEBOOK_CLIENT_ID!,
  //     clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
  //   }
  // }
});