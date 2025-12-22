/**
 * Global teardown - runs once after all tests
 * Optional: Clean up test database
 */
export default async function globalTeardown() {
  console.log('\n🧹 Test cleanup complete\n');

  // Note: We don't drop the test database by default
  // This makes subsequent test runs faster (no need to recreate)
  // If you want to drop it, uncomment below:

  // const { Client } = require('pg');
  // const client = new Client({ connectionString: baseConnectionString });
  // await client.connect();
  // await client.query('DROP DATABASE IF EXISTS deuceleague_test');
  // await client.end();
}
