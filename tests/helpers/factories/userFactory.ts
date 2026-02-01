import { prismaTest } from '../../setup/prismaTestClient';
import { Role, UserStatus } from '@prisma/client';

// Simple random string generator to replace faker
function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomName(): string {
  const firstNames = ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const lastNames = ['Smith', 'Doe', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller'];
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}

export interface CreateUserOptions {
  id?: string;
  name?: string;
  email?: string;
  username?: string;
  role?: Role;
  status?: UserStatus;
  completedOnboarding?: boolean;
  emailVerified?: boolean;
}

/**
 * Create a test user with sensible defaults
 */
export async function createTestUser(options: CreateUserOptions = {}) {
  const uniqueSuffix = randomString(8);

  return prismaTest.user.create({
    data: {
      id: options.id ?? `test-user-${uniqueSuffix}`,
      name: options.name ?? randomName(),
      email: options.email ?? `test-${uniqueSuffix}@example.com`,
      username: options.username ?? `testuser_${uniqueSuffix}`,
      displayUsername: options.username ?? `testuser_${uniqueSuffix}`,
      role: options.role ?? Role.USER,
      status: options.status ?? UserStatus.ACTIVE,
      completedOnboarding: options.completedOnboarding ?? true,
      emailVerified: options.emailVerified ?? true,
    },
  });
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number, options: CreateUserOptions = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push(await createTestUser(options));
  }
  return users;
}

/**
 * Create a test admin user
 */
export async function createTestAdmin(options: CreateUserOptions = {}) {
  const user = await createTestUser({
    ...options,
    role: Role.ADMIN,
  });

  const admin = await prismaTest.admin.create({
    data: {
      user: { connect: { id: user.id } },
      status: 'ACTIVE',
    },
  });

  return { user, admin };
}
