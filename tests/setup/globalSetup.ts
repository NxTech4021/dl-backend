import { execSync } from 'child_process';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

const TEST_DATABASE_NAME = 'deuceleague_test';

/**
 * Global setup - runs once before all tests
 * Creates the test database and runs migrations
 */
export default async function globalSetup() {
  console.log('\n🔧 Setting up test environment...\n');

  // Parse the DATABASE_URL to get connection details
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set in .env.test');
  }

  // Connect to default postgres database to create test database
  const urlParts = new URL(databaseUrl);
  const baseConnectionString = `postgresql://${urlParts.username}:${urlParts.password}@${urlParts.host}/postgres`;

  const client = new Client({ connectionString: baseConnectionString });

  try {
    await client.connect();

    // Check if test database exists
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [TEST_DATABASE_NAME]
    );

    if (result.rows.length === 0) {
      console.log(`📦 Creating test database: ${TEST_DATABASE_NAME}`);
      await client.query(`CREATE DATABASE ${TEST_DATABASE_NAME}`);
      console.log('✅ Test database created\n');
    } else {
      console.log(`✅ Test database already exists: ${TEST_DATABASE_NAME}\n`);
    }
  } catch (error) {
    // Database might already exist or other error
    console.error('Database setup error:', error);
  } finally {
    await client.end();
  }

  // Sync database schema with Prisma schema using db push
  // We use db push instead of migrate deploy because:
  // 1. It's faster for test databases
  // 2. It handles schema drift better
  // 3. It doesn't require migration files to be in sync
  console.log('🔄 Syncing test database schema...');
  try {
    execSync('npx prisma db push --accept-data-loss', {
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: 'pipe',
    });
    console.log('✅ Database schema synced\n');
  } catch (error: any) {
    console.error('Schema sync error:', error.message);
    // Don't throw - schema might already be in sync
  }

  // Generate Prisma client
  console.log('🔄 Generating Prisma client...');
  try {
    execSync('npx prisma generate', {
      cwd: path.join(__dirname, '../..'),
      stdio: 'pipe',
    });
    console.log('✅ Prisma client generated\n');
  } catch (error: any) {
    console.log('ℹ️  Prisma client generation:', error.message);
  }

  console.log('🎉 Test environment ready!\n');
}
