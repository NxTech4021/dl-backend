import { prisma } from "./prisma";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { createAuthMiddleware, emailOTP, username } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { sendEmail } from "../config/nodemailer";
import {
  getBackendBaseURL,
  getTrustedOrigins,
  getAuthBasePath,
} from "../config/network";

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
// Get auth base path dynamically based on environment
// Development: /api/auth/, Production: /auth/ (nginx handles /api prefix)
const authBasePath = getAuthBasePath();
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
  "http://192.168.100.3:8081",
  "exp://192.168.100.3:8081",
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
  "http://172.20.10.2:3001",
  "http://172.20.10.2:82",
  "http://172.20.10.2:8081",
  "exp://172.20.10.2:8081",
  "http://192.168.0.60:3001",
  "http://192.168.0.60:82",
  "http://192.168.0.60:8081",
  "exp://192.168.0.60:8081",
  "http://192.168.100.36:8081",
  "exp://192.168.100.36:8081",
  "exp://192.168.1.4:8081",
  "http://192.168.1.4:8081",
  "exp://192.168.0.109:8081",
  "http://10.72.191.11:8081",
  "exp://10.72.191.11:8081",
  "exp://172.20.10.11:8081",
  "http://172.20.10.11:8081",
  "exp://192.168.100.67:8081",
  "http://192.168.100.67:8081",
  "exp://10.72.191.105:8081",
  "http://10.72.191.105:8081",
  "exp://192.168.1.3:8081",
  "http://192.168.1.3:8081",
  "exp://192.168.100.110:8081",
  "http://192.168.100.110:8081",
  "exp://192.168.1.7:8081",
  "http://192.168.1.7:8081",
  "exp://10.72.186.182:8081",
  "http://10.72.186.182:8081",
  "exp://192.168.100.144:8081",
  "http://192.168.100.144:8081",
  "http://192.168.0.123:8081",
  "exp://192.168.0.123:8081",
  "http://192.168.0.197:8081",
  "exp://192.168.0.197:8081",
  "https://staging.appdevelopers.my",
  "deuceleague://",
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

// Test database connection
prisma
  .$connect()
  .then(() => {
    console.log("✅ Database connection successful");
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
  });

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
          let title = "";
          let message = "";
          let buttonColor = "#3B82F6"; // Blue

          if (type === "sign-in") {
            console.log("Sending sign-in email to", email);
            subject = "Your Sign-In Code - DeuceLeague";
            title = "Sign In to Your Account";
            message = "Use this code to sign in to your DeuceLeague account.";
            buttonColor = "#3B82F6"; // Blue
          } else if (type === "email-verification") {
            console.log("Sending email verification email to", email);
            subject = "Verify Your Email - DeuceLeague";
            title = "Welcome to DeuceLeague!";
            message = "Please verify your email address to complete your registration.";
            buttonColor = "#10B981"; // Green
          } else if (type === "forget-password") {
            console.log("Sending forget password email to", email);
            subject = "Password Reset Code - DeuceLeague";
            title = "Reset Your Password";
            message = "You requested to reset your password. Use the code below to continue.";
            buttonColor = "#EF4444"; // Red
          }

          if (subject) {
            html = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${subject}</title>
              </head>
              <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td align="center" style="padding: 40px 0;">
                      <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                        
                        <!-- Header -->
                        <tr>
                          <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, ${buttonColor} 0%, ${buttonColor}dd 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                              DeuceLeague
                            </h1>
                          </td>
                        </tr>

                        <!-- Content -->
                        <tr>
                          <td style="padding: 40px;">
                            <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 24px; font-weight: 600;">
                              ${title}
                            </h2>
                            <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px; line-height: 1.5;">
                              ${message}
                            </p>

                            <!-- OTP Box -->
                            <div style="background-color: #f9fafb; border: 2px dashed ${buttonColor}; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                                Your verification code
                              </p>
                              <div style="font-size: 36px; font-weight: 700; color: ${buttonColor}; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                ${otp}
                              </div>
                            </div>

                            <!-- Info -->
                            <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                              This code will expire in <strong style="color: #111827;">15 minutes</strong>. 
                              If you didn't request this code, please ignore this email.
                            </p>
                          </td>
                        </tr>

                        <!-- Security Notice -->
                        <tr>
                          <td style="padding: 20px 40px; background-color: #fef3c7; border-top: 1px solid #fde68a;">
                            <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                              🔒 <strong>Security tip:</strong> Never share this code with anyone. DeuceLeague will never ask for your verification code.
                            </p>
                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="padding: 30px 40px; text-align: center; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
                              © ${new Date().getFullYear()} DeuceLeague. All rights reserved.
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                              Join leagues. Track matches. Level up your game.
                            </p>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `;

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
    // disableOriginCheck: true, // Need to remove for prod
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

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID! as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string,
    },
    // Facebook - uncomment when credentials are configured
    // facebook: {
    //   clientId: process.env.FACEBOOK_CLIENT_ID! as string,
    //   clientSecret: process.env.FACEBOOK_CLIENT_SECRET! as string,
    // },
    // Apple - uncomment when credentials are configured
    // apple: {
    //   clientId: process.env.APPLE_CLIENT_ID! as string,
    //   clientSecret: process.env.APPLE_CLIENT_SECRET! as string,
    // },
  },
});
