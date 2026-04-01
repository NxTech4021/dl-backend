import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for match edit timezone handling (Issue #031)
 *
 * Bug: Edit match uses `new Date(matchDate)` which treats naive
 * datetime strings as UTC. Should use dayjs.tz() like create does.
 *
 * Both edit endpoints must have timezone conversion:
 * 1. matchController.ts (legacy PUT /api/match/:id)
 * 2. matchInvitationController.ts (PUT /api/matches/:id/edit)
 *
 * And the service must pass matchDate to the update query:
 * 3. matchInvitationService.ts editMatch()
 */

describe('#031: Legacy matchController.updateMatch timezone', () => {
  const controllerFile = fs.readFileSync(
    path.join(__dirname, '../../../src/controllers/matchController.ts'),
    'utf-8'
  );

  it('should NOT use raw new Date(matchDate) without timezone', () => {
    // The old pattern: updateData.matchDate = new Date(matchDate)
    // Should be replaced with dayjs.tz() conversion
    const updateSection = controllerFile.slice(
      controllerFile.indexOf('const updateData'),
      controllerFile.indexOf('const match = await prisma.match.update')
    );
    expect(updateSection).not.toMatch(/updateData\.matchDate\s*=\s*new Date\(matchDate\)/);
  });

  it('should use dayjs.tz for timezone conversion', () => {
    expect(controllerFile).toMatch(/dayjs\.tz\(matchDate/);
  });

  it('should read deviceTimezone from request body', () => {
    expect(controllerFile).toMatch(/deviceTimezone/);
  });
});

describe('#031: matchInvitationController.editMatch timezone', () => {
  const controllerFile = fs.readFileSync(
    path.join(__dirname, '../../../src/controllers/match/matchInvitationController.ts'),
    'utf-8'
  );

  it('should NOT use raw new Date(matchDate) in editMatch', () => {
    // Find the editMatch function section
    const editSection = controllerFile.slice(
      controllerFile.indexOf('export const editMatch'),
      controllerFile.indexOf('export const postMatchToChat') || controllerFile.length
    );
    expect(editSection).not.toMatch(/new Date\(matchDate\)/);
  });

  it('should use dayjs.tz for timezone conversion in editMatch', () => {
    const editSection = controllerFile.slice(
      controllerFile.indexOf('export const editMatch'),
      controllerFile.indexOf('export const postMatchToChat') || controllerFile.length
    );
    expect(editSection).toMatch(/dayjs\.tz\(matchDate/);
  });
});

describe('#031: matchInvitationService.editMatch passes matchDate', () => {
  const serviceFile = fs.readFileSync(
    path.join(__dirname, '../../../src/services/match/matchInvitationService.ts'),
    'utf-8'
  );

  it('should include matchDate in updateData', () => {
    const editSection = serviceFile.slice(
      serviceFile.indexOf('async editMatch'),
      serviceFile.indexOf('Delete old participants')
    );
    expect(editSection).toMatch(/updateData\.matchDate|matchDate.*updateData/);
  });
});
