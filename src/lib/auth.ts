import { prisma } from "./prisma";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { createAuthMiddleware, emailOTP, username } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { sendEmail } from "../config/nodemailer";
import { getBackendBaseURL, getTrustedOrigins } from "../config/network";


// Debug environment variables
console.log("🔐 Better Auth Environment Check:");
console.log(
  `   BETTER_AUTH_SECRET: ${
    process.env.BETTER_AUTH_SECRET ? "✅ Set" : "❌ Missing"
  }`
);
console.log(
  `   DATABASE_URL: ${process.env.DATABASE_URL ? "✅ Set" : "❌ Missing"}`
);
console.log(
  `   BASE_URL: ${
    process.env.BASE_URL || "Using default: http://192.168.1.3:3001"
  }`
);
const authBasePath = process.env.BETTER_AUTH_BASE_PATH || "/api/auth";
console.log(`   BETTER_AUTH_BASE_PATH: ${authBasePath}`);
const defaultTrustedOrigins = [
  "http://localhost:3030",
  "http://localhost",
  "http://localhost:82",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://192.168.1.3:3001",
  "http://192.168.1.7:3001",
  "http://192.168.1.5:8081",
  "exp://192.168.1.5:8081",
  "http://192.168.100.28:8081",
  "exp://192.168.100.28:8081",
  "http://192.168.100.53:8081",
  "exp://192.168.100.53:8081",
  "http://172.20.10.3:8081",
  "exp://172.20.10.3:8081",
  "http://10.72.179.58:8081",
  "exp://10.72.179.58:8081",
  "http://10.72.180.20:8081",
  "exp://10.72.180.20:8081",
  "http://192.168.100.224:8081",
  "exp://192.168.100.224:8081",
  "exp://192.168.0.123:8081",
  "http://192.168.0.123:8081",
  "https://staging.appdevelopers.my",
];
const envTrustedOrigins = [
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const combinedTrustedOrigins = Array.from(
  new Set([
    ...defaultTrustedOrigins,
    ...envTrustedOrigins,
    ...corsAllowedOrigins,
    ...getTrustedOrigins(),
  ])
);
console.log("   Trusted origins:", combinedTrustedOrigins);

// Test database connection
prisma
  .$connect()
  .then(() => {
    console.log("✅ Database connection successful");
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
  });

// Add query logging to debug verification issues
// TODO: Re-enable query logging when Prisma client is configured with log: ['query']
// prisma.$on("query", (e) => {
//   if (e.query.includes("verification")) {
//     console.log("🔍 Verification Query:", e.query);
//     console.log("🔍 Verification Params:", e.params);
//     console.log("🔍 Verification Duration:", e.duration + "ms");

//     // Add specific debugging for verification lookups
//     if (e.query.includes("SELECT") && e.query.includes("verification")) {
//       console.log("🔍 Looking up verification records for:", e.params[0]);
//     }
//   }
// });

export const auth = betterAuth({
  appName: "DeuceLeague",
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Configure user schema to include phoneNumber as an additional field
  user: {
    additionalFields: {
      phoneNumber: {
        type: "string",
        required: false,
        input: true, // Allow this field to be set during user creation
      },
    },
  },

  plugins: [
    expo(),
    username() as any,
    emailOTP({
      // We add Rate limit later for emails
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        try {
          let subject = "";
          let html = "";

          if (type === "sign-in") {
            console.log("Sending sign-in email to", email);
            subject = "Your Sign-In Code";
            html = `<p>Your sign-in code is: <strong>${otp}</strong>. It will expire in 15 minutes.</p>`;
          } else if (type === "email-verification") {
            console.log("Sending email verification email to", email);
            subject = "Verify Your Email Address";
            html = `<p>Your email verification code is: <strong>${otp}</strong>. It will expire in 15 minutes.</p>`;
          } else if (type === "forget-password") {
            console.log("Sending forget password email to", email);
            const user = await prisma.user.findUnique({
              where: { email },
            });

            subject = "Your Password Reset Code";
            html = `<p>Your password reset code is: <strong>${otp}</strong>. It will expire in 15 minutes.</p>`;
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

  // automatic sign-in after email verification
  emailVerification: {
    autoSignInAfterVerification: true,
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  basePath: authBasePath,

  trustedOrigins: combinedTrustedOrigins,

  // Session configuration for mobile/Expo compatibility
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Advanced configuration for mobile/Expo compatibility
  advanced: {
    useSecureCookies: false, // Set to false for development/localhost
    crossSubDomainCookies: {
      enabled: false, // Disable for mobile apps
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: false, // Set to false for development/localhost
      sameSite: "lax", // Better for mobile apps
    },
    // Add explicit cookie configuration for better session handling
    cookies: {
      sessionToken: {
        attributes: {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        },
      },
    },
  },

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
