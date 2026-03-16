import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for dedicated go-live endpoint.
 *
 * BUG 9: No dedicated "go live" endpoint — only generic update
 */

const routesPath = path.join(
  __dirname,
  '../../../src/routes/seasonRoutes.ts'
);
const routesCode = fs.readFileSync(routesPath, 'utf-8');

const controllerPath = path.join(
  __dirname,
  '../../../src/controllers/seasonController.ts'
);
const controllerCode = fs.readFileSync(controllerPath, 'utf-8');

describe('BUG 9: Dedicated go-live route must exist', () => {
  it('should have a POST /:id/go-live route', () => {
    expect(routesCode).toMatch(/['"]?\/:id\/go-live['"]?/);
  });

  it('should require admin authentication on go-live route', () => {
    // The go-live route registration line should include requireAdmin
    const goLiveLine = routesCode
      .split('\n')
      .find(line => line.includes('go-live') && line.includes('seasonRoutes'));
    expect(goLiveLine).toBeDefined();
    expect(goLiveLine).toContain('requireAdmin');
  });

  it('should be placed before generic /:id DELETE route', () => {
    // go-live must come before delete to avoid Express route conflicts
    const goLiveIdx = routesCode.indexOf('go-live');
    const deleteIdx = routesCode.indexOf("seasonRoutes.delete('/:id'");
    expect(goLiveIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(goLiveIdx).toBeLessThan(deleteIdx);
  });
});

describe('BUG 9: Go-live handler must exist in controller', () => {
  it('should export a goLiveSeason handler', () => {
    expect(controllerCode).toMatch(
      /export\s+const\s+goLiveSeason\s*=/
    );
  });

  it('should validate season is UPCOMING before activation', () => {
    // Extract the goLiveSeason handler
    const goLiveStart = controllerCode.indexOf('export const goLiveSeason');
    const goLiveSection = controllerCode.slice(goLiveStart, goLiveStart + 2000);
    expect(goLiveSection).toMatch(/UPCOMING/);
  });

  it('should set both status ACTIVE and isActive true', () => {
    const goLiveStart = controllerCode.indexOf('export const goLiveSeason');
    const goLiveSection = controllerCode.slice(goLiveStart, goLiveStart + 2000);
    expect(goLiveSection).toContain('ACTIVE');
    expect(goLiveSection).toContain('isActive');
  });

  it('should call promoteAllUsers', () => {
    const goLiveStart = controllerCode.indexOf('export const goLiveSeason');
    const goLiveSection = controllerCode.slice(goLiveStart, goLiveStart + 2000);
    expect(goLiveSection).toMatch(/promoteAllUsers/);
  });

  it('should send notifications to promoted users', () => {
    const goLiveStart = controllerCode.indexOf('export const goLiveSeason');
    const goLiveSection = controllerCode.slice(goLiveStart, goLiveStart + 3000);
    expect(goLiveSection).toMatch(/waitlistPromoted|notification.*promot/i);
  });
});
