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
