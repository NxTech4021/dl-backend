import { getBackendBaseURL } from "../config/network";

type RequiredEnv = "FIUU_MERCHANT_ID" | "FIUU_VERIFY_KEY" | "FIUU_PRIVATE_KEY";

const requiredVariables: RequiredEnv[] = [
  "FIUU_MERCHANT_ID",
  "FIUU_VERIFY_KEY",
  "FIUU_PRIVATE_KEY",
];

function assertEnvVars() {
  const missing = requiredVariables.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing FIUU configuration. Please set the following environment variables: ${missing.join(
        ", ",
      )}`,
    );
  }
}

export interface FiuuConfig {
  merchantId: string;
  verifyKey: string;
  privateKey: string;
  baseUrl: string;
  portalUrl: string;
  callbackBaseUrl: string;
}

export function getFiuuConfig(requestHost?: string | null): FiuuConfig {
  assertEnvVars();

  const merchantId = process.env.FIUU_MERCHANT_ID!;
  const verifyKey = process.env.FIUU_VERIFY_KEY!;
  const privateKey = process.env.FIUU_PRIVATE_KEY!;

  const baseUrl =
    process.env.FIUU_SANDBOX_URL?.replace(/\/$/, "") ||
    "https://sandbox.fiuu.com";

  const portalUrl =
    process.env.FIUU_PORTAL_URL?.replace(/\/$/, "") ||
    "https://sandbox-portal.fiuu.com";

  // TODO(AWS-M-71, SECURITY): buildPublicBaseUrl builds returnUrl from the
  // client-controlled Host header — open redirect / phishing vector if
  // FIUU_PUBLIC_CALLBACK_URL is unset. Add a hard check here that throws
  // in production when the env var is missing. BLOCKING PRECONDITION before
  // shipping this fix: Addy must verify FIUU_PUBLIC_CALLBACK_URL is set in
  // current prod .env — otherwise the throw takes current prod down on deploy.
  // Track at docs/plans/2026-04-14-aws-migration-architecture-stress-tests.md.
  const callbackBaseUrl =
    process.env.FIUU_PUBLIC_CALLBACK_URL ??
    buildPublicBaseUrl(requestHost) ??
    getBackendBaseURL();

  return {
    merchantId,
    verifyKey,
    privateKey,
    baseUrl,
    portalUrl,
    callbackBaseUrl,
  };
}

function buildPublicBaseUrl(requestHost?: string | null): string | null {
  const source = requestHost ?? "";
  if (!source) {
    return null;
  }

  const host = source.split(",")[0]?.trim();
  if (!host) {
    return null;
  }

  // Treat ngrok/custom domains as https by default
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
