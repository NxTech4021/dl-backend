// This file previously exported `requireRole(roles: string[])` which had zero
// callers across the codebase. Deleted during pre-Phase 0 cleanup (2026-04-15).
// If role-based authorization beyond admin/user is needed in the future:
//   - Consider adding it to auth.middleware.ts alongside verifyAuth/requireAdmin.
//   - better-auth has role/permission plugins worth evaluating before rolling custom.
export {};
