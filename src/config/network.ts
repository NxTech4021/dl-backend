import { execSync } from "child_process";
import { networkInterfaces } from "os";

/**
 * Get the local IP address of the machine
 * Prioritizes non-internal IPv4 addresses
 */
export function getLocalIPAddress(): string {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    const netInterfaces = nets[name];
    if (!netInterfaces) continue;

    for (const net of netInterfaces) {
      // Skip internal (localhost) and IPv6 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }

  // Fallback to localhost if no external IP found
  return "localhost";
}

/**
 * Resolve the host machine's LAN IP when running inside Docker.
 * Uses host.docker.internal DNS (available on Docker Desktop).
 * Returns null if not in Docker or resolution fails.
 */
function resolveHostIPSync(): string | null {
  // Quick check: if DATABASE_URL uses host.docker.internal, we're in Docker
  const inDocker = process.env.DATABASE_URL?.includes("host.docker.internal");
  if (!inDocker) return null;

  try {
    // Use nslookup (available on Alpine) since getent is not
    const result: string = execSync(
      "nslookup host.docker.internal 2>/dev/null | grep 'Address' | tail -1",
      { timeout: 2000 }
    ).toString().trim();
    // nslookup output: "Address: 192.168.1.4" or "Address 1: 192.168.1.4"
    const match = result.match(/(\d+\.\d+\.\d+\.\d+)/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // nslookup not available or resolution failed
  }
  return null;
}

/**
 * Get the base URL for the backend service
 * Uses environment variables with smart defaults
 */
export function getBackendBaseURL(): string {
  // If BASE_URL is explicitly set, use it
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }

  // Get port from environment or default to 3001
  const port = process.env.PORT || "3001";

  // If LOCAL_IP is set in environment, use it
  if (process.env.LOCAL_IP) {
    return `http://${process.env.LOCAL_IP}:${port}`;
  }

  // Auto-detect local IP for development
  const localIP = getLocalIPAddress();

  // In production or if localhost is detected, use localhost
  if (process.env.NODE_ENV === "production" || localIP === "localhost") {
    return `http://localhost:${port}`;
  }

  return `http://${localIP}:${port}`;
}

/**
 * Get trusted origins for CORS and auth
 */
export function getTrustedOrigins(): string[] {
  const baseOrigins = [
    "exp://192.168.0.101:8081",
    "exp://192.168.0.107:8081",
    "http://localhost:3030",
    "http://localhost:82",
    "http://localhost:3001",
    "http://localhost:8081",
  ];

  // Add the auto-detected IP variations
  const localIP = getLocalIPAddress();
  if (localIP !== "localhost") {
    baseOrigins.push(
      `http://${localIP}:3001`,
      `http://${localIP}:8081`,
      `http://${localIP}:82`,
      `http://${localIP}:3030`
    );
  }

  // In Docker, also add the host machine's LAN IP (what mobile devices actually use)
  const hostIP = resolveHostIPSync();
  if (hostIP && hostIP !== localIP) {
    baseOrigins.push(
      `http://${hostIP}:3001`,
      `http://${hostIP}:8081`,
      `http://${hostIP}:82`,
      `http://${hostIP}:3030`
    );
    if (process.env.NODE_ENV !== "production") {
      console.log(`🐳 Docker detected — added host LAN IP ${hostIP} to trusted origins`);
    }
  }

  // Add origins from BETTER_AUTH_URL (without path) if provided
  if (process.env.BETTER_AUTH_URL) {
    try {
      const url = new URL(process.env.BETTER_AUTH_URL);
      baseOrigins.push(`${url.protocol}//${url.host}`, `${url.protocol}//${url.hostname}:3030`);
    } catch (error) {
      console.warn(
        `[network] Failed to parse BETTER_AUTH_URL (${process.env.BETTER_AUTH_URL}):`,
        error
      );
    }
  }

  // Add origins from CORS_ALLOWED_ORIGINS env if provided
  if (process.env.CORS_ALLOWED_ORIGINS) {
    const corsOrigins = process.env.CORS_ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    baseOrigins.push(...corsOrigins);
  }

  // Add any additional origins from environment
  if (process.env.ADDITIONAL_ORIGINS) {
    const additionalOrigins = process.env.ADDITIONAL_ORIGINS.split(",").map(
      (o) => o.trim()
    );
    baseOrigins.push(...additionalOrigins);
  }

  return baseOrigins;
}

/**
 * Get the API route prefix
 * - Development: defaults to "/api" (can be overridden with API_PREFIX env var)
 * - Production: defaults to "" (can be overridden with API_PREFIX env var)
 * This allows flexibility where production might use nginx to handle the /api prefix
 */
export function getApiPrefix(): string {
  // If API_PREFIX is explicitly set, use it
  if (process.env.API_PREFIX !== undefined) {
    return process.env.API_PREFIX;
  }

  // Default: use "/api" in development, "" in production
  // Production typically has nginx/reverse proxy handling the /api prefix
  return process.env.NODE_ENV === "production" ? "" : "/api";
}

/**
 * Get the auth base path
 * - Development: defaults to "/api/auth/" (can be overridden with BETTER_AUTH_BASE_PATH env var)
 * - Production: defaults to "/auth/" (can be overridden with BETTER_AUTH_BASE_PATH env var)
 * This matches the API prefix pattern where production has nginx handling the /api prefix
 */
export function getAuthBasePath(): string {
  // If BETTER_AUTH_BASE_PATH is explicitly set, use it
  if (process.env.BETTER_AUTH_BASE_PATH !== undefined) {
    return process.env.BETTER_AUTH_BASE_PATH;
  }

  // Default: use "/api/auth/" in development, "/auth/" in production
  // Production typically has nginx/reverse proxy handling the /api prefix
  return process.env.NODE_ENV === "production" ? "/auth/" : "/api/auth/";
}
