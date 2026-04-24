import { prisma } from "./prisma";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { createAuthMiddleware, emailOTP, username } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { sendEmail } from "../config/nodemailer";
import { initializeUserOnboarding } from "../services/notification/onboardingNotificationService";
import {
  getBackendBaseURL,
  getAuthBasePath,
  getTrustedOrigins as getNetworkTrustedOrigins,
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

// Environment-aware security settings
const isProduction = process.env.NODE_ENV === 'production';
// Session expiry: configurable via env, defaults to 30 days (community app — users expect persistent sessions)
const sessionExpirySeconds = parseInt(process.env.SESSION_EXPIRY_SECONDS || '2592000', 10); // 30 days
// Session table cleanup runs weekly via scheduleSessionCleanup() in jobs/maintenanceJobs.ts.
console.log(`   BETTER_AUTH_BASE_PATH: ${authBasePath}`);

// Trusted origins: uses auto-detected LAN IP from network.ts + env overrides
// No need to hardcode IPs — they're detected at startup
const trustedOrigins = [
  ...getNetworkTrustedOrigins(),
  // Expo native app deep link scheme
  'deuceleague://',
  // Merge any extra origins from TRUSTED_ORIGINS env (e.g. staging domain)
  ...(process.env.TRUSTED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []),
];

// Test database connection
prisma
  .$connect()
  .then(() => {
    console.log("✅ Database connection successful");
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
  });

// TODO (2026-04-20, docs/issues/backlog/docker-logs-hygiene-2026-04-20.md H2):
// Better Auth logs "Invalid password" at ERROR level. That is a routine failed
// login, not a system error — it will false-page Sentry/CloudWatch once we
// wire production error alerting. Configure the `logger` option on this
// betterAuth({...}) call to downgrade INVALID_PASSWORD / INVALID_CREDENTIALS
// to WARN. Needs regression test for any alerting we later hook up.
export const auth = betterAuth({
  appName: "DeuceLeague",
  secret: process.env.BETTER_AUTH_SECRET,

  // VE-1 (P0): better-auth rate limiting defaults to disabled unless NODE_ENV=production.
  // TODO(production): Before deploying to production, EITHER:
  //   1. Set NODE_ENV=production in docker-compose (recommended), OR
  //   2. Uncomment the rateLimit block below to force-enable in all environments.
  // Without this, OTP endpoints have no IP-based throttling — only per-OTP attempt limits (3 guesses).
  // rateLimit: {
  //   enabled: true,
  //   storage: "memory", // Acceptable for single-instance; use "secondary-storage" for multi-instance.
  // },

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Add hooks to block admin login from mobile
  // Use 'before' hook to check user role BEFORE sign-in completes
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const userAgent = ctx.headers?.get('user-agent') || '';
      const clientType = ctx.headers?.get('x-client-type');
      const path = ctx.path;

      // Only check on sign-in endpoints
      if (!path.includes('sign-in') && !path.includes('email-otp/verify-email')) {
        return;
      }

      console.log("🔒 [Auth Hook BEFORE] Path:", path);
      console.log("🔒 [Auth Hook BEFORE] User-Agent:", userAgent);

      // Detect mobile client via User-Agent (Expo/React Native) OR X-Client-Type header
      const isMobileUserAgent = /expo|reactnative|okhttp/i.test(userAgent);
      const isMobileClient = clientType === 'mobile' || isMobileUserAgent;

      if (!isMobileClient) {
        console.log("🔒 [Auth Hook BEFORE] Skipping - not mobile client");
        return;
      }

      console.log("🔒 [Auth Hook BEFORE] Mobile client detected, checking user...");

      // Get email from request body
      const body = ctx.body as any;
      const email = body?.email;
      console.log("🔒 [Auth Hook BEFORE] Email:", email);

      if (!email) {
        console.log("🔒 [Auth Hook BEFORE] No email in body, skipping");
        return;
      }

      // Look up user by email to check role BEFORE sign-in
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: { role: true },
        });
        console.log("🔒 [Auth Hook BEFORE] User role:", user?.role);

        if (user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN')) {
          console.log("🔒 [Auth Hook BEFORE] BLOCKING ADMIN LOGIN!");
          throw new APIError("FORBIDDEN", {
            message: "Admin accounts cannot sign in via the mobile app. Please use the web dashboard.",
          });
        }
      } catch (error) {
        if (error instanceof APIError) throw error;
        console.error("Error checking admin mobile login:", error);
      }
    }),
  },

  // Initialize onboardingStep for new users created via better-auth (email signup)
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { onboardingStep: "PERSONAL_INFO" },
            });
          } catch (error) {
            console.error("Failed to initialize onboardingStep for user", user.id, error);
          }
          // Fire profile-reminder notifications (5s delay, non-blocking)
          initializeUserOnboarding(user.id).catch((err) =>
            console.error("Failed to initialize onboarding notifications for user", user.id, err)
          );
        },
      },
    },
  },

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
      // VE-2: Align OTP expiry with email template (15 minutes)
      // better-auth default is 300s (5min) — too short, causes user confusion
      expiresIn: 900, // 15 minutes
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
            buttonColor = "#FEA04D"; // Brand Color
          } else if (type === "forget-password") {
            console.log("Sending forget password email to", email);
            subject = "Password Reset Code - DeuceLeague";
            title = "Reset Your Password";
            message = "You requested to reset your password. Use the code below to continue.";
            buttonColor = "#165E99"; // Blue
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

  trustedOrigins: trustedOrigins,

  // Session configuration for mobile/Expo compatibility
  // Security: Reduced expiry in production (24h default), configurable via SESSION_EXPIRY_SECONDS env var
  session: {
    expiresIn: sessionExpirySeconds,
    updateAge: 60 * 60, // 1 hour (reduced from 1 day for better security)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Advanced configuration for mobile/Expo compatibility
  // Security: Environment-aware settings - secure in production, permissive in development
  advanced: {
    useSecureCookies: isProduction,
    disableOriginCheck: !isProduction,
    crossSubDomainCookies: {
      enabled: false, // Disable for mobile apps
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
    },
    // Add explicit cookie configuration for better session handling
    cookies: {
      sessionToken: {
        attributes: {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "strict" : "lax",
          maxAge: sessionExpirySeconds,
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
