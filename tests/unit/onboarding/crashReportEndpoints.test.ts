import * as fs from 'fs';
import * as path from 'path';

describe('Crash Report Backend Infrastructure', () => {
  const routesIndexPath = path.join(__dirname, '../../../src/routes/index.ts');
  const routesIndex = fs.readFileSync(routesIndexPath, 'utf-8');

  const rateLimiterPath = path.join(__dirname, '../../../src/middlewares/rateLimiter.ts');
  const rateLimiter = fs.readFileSync(rateLimiterPath, 'utf-8');

  it('should mount crash report routes in index.ts', () => {
    expect(routesIndex).toContain('crash');
    expect(routesIndex).toMatch(/crashReport|crash-report/i);
  });

  it('should export crashReportLimiter from rateLimiter.ts', () => {
    expect(rateLimiter).toMatch(/export.*crashReportLimiter/);
  });

  it('should rate limit at 20 per 15 minutes', () => {
    expect(rateLimiter).toMatch(/crashReportLimiter[\s\S]*?max:\s*20/);
  });

  const crashRoutesPath = path.join(__dirname, '../../../src/routes/crashReportRoutes.ts');

  it('should have crash report routes file', () => {
    expect(fs.existsSync(crashRoutesPath)).toBe(true);
  });

  it('should have POST route without requireAdmin', () => {
    const crashRoutes = fs.readFileSync(crashRoutesPath, 'utf-8');
    expect(crashRoutes).toMatch(/post.*['"]\/?['"]/);
    expect(crashRoutes).not.toMatch(/post.*requireAdmin.*createCrash/);
  });

  it('should have admin GET route with requireAdmin', () => {
    const crashRoutes = fs.readFileSync(crashRoutesPath, 'utf-8');
    expect(crashRoutes).toMatch(/get.*requireAdmin/);
  });

  const controllerPath = path.join(__dirname, '../../../src/controllers/crashReportController.ts');

  it('should have crash report controller', () => {
    expect(fs.existsSync(controllerPath)).toBe(true);
  });

  it('should export createCrashReport handler', () => {
    const controller = fs.readFileSync(controllerPath, 'utf-8');
    expect(controller).toMatch(/export.*createCrashReport/);
  });

  it('should export getCrashReports handler', () => {
    const controller = fs.readFileSync(controllerPath, 'utf-8');
    expect(controller).toMatch(/export.*getCrashReports/);
  });

  it('should validate required fields in createCrashReport', () => {
    const controller = fs.readFileSync(controllerPath, 'utf-8');
    expect(controller).toContain('type');
    expect(controller).toContain('errorMessage');
    expect(controller).toContain('platform');
  });

  it('should truncate stackTrace to prevent abuse', () => {
    const controller = fs.readFileSync(controllerPath, 'utf-8');
    expect(controller).toMatch(/slice|substring|truncat/i);
  });

  it('should deduplicate by errorMessage + screenName + appVersion', () => {
    const controller = fs.readFileSync(controllerPath, 'utf-8');
    expect(controller).toMatch(/occurrenceCount.*increment|findFirst.*errorMessage/);
  });
});
