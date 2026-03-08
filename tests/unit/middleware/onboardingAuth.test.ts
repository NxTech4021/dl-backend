/**
 * BUG 6: Missing auth middleware on onboarding endpoints
 *
 * Verifies that all onboarding endpoints have verifyAuth middleware.
 * Uses source code inspection to detect missing middleware.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('BUG 6: Auth middleware on all onboarding endpoints', () => {
  let routeFileContent: string;

  beforeAll(() => {
    const routePath = path.join(__dirname, '../../../src/routes/onboarding.ts');
    routeFileContent = fs.readFileSync(routePath, 'utf-8');
  });

  it('GET /:sport/questions should have verifyAuth middleware', () => {
    // Find the route definition for /:sport/questions
    const questionsRouteMatch = routeFileContent.match(
      /router\.get\(["']\/:(sport|[\w]+)\/questions["'].*?\)/s
    );
    expect(questionsRouteMatch).not.toBeNull();

    // The route definition should include verifyAuth
    const routeLine = questionsRouteMatch![0];
    expect(routeLine).toContain('verifyAuth');
  });

  it('GET /locations/search should have verifyAuth middleware', () => {
    // Find the route definition for /locations/search
    const searchRouteMatch = routeFileContent.match(
      /router\.get\(["']\/locations\/search["'].*?\)/s
    );
    expect(searchRouteMatch).not.toBeNull();

    // The route definition should include verifyAuth
    const routeLine = searchRouteMatch![0];
    expect(routeLine).toContain('verifyAuth');
  });
});
