/**
 * Tests for Issue #036: Match Status Transition + Standings Service
 * After Admin Dispute Resolution
 *
 * Verifies:
 * - BUG 1: 5 dispute resolution actions set status to COMPLETED
 * - BUG 2: V2 standings service used instead of legacy V1
 * - BUG 3: MatchResult records refreshed during recalculation
 * - BUG 4: REQUEST_MORE_INFO → UNDER_REVIEW (not RESOLVED)
 * - BUG 5: REQUEST_MORE_INFO doesn't set resolvedAt
 * - editMatchResult also uses V2 standings
 */

import * as fs from 'fs';
import * as path from 'path';

const adminMatchServicePath = path.join(
  __dirname, '../../../src/services/admin/adminMatchService.ts'
);
const adminMatchServiceCode = fs.readFileSync(adminMatchServicePath, 'utf-8');

describe('Issue #036: Dispute Resolution Status Transitions', () => {

  describe('BUG 1: Resolution actions must set COMPLETED', () => {

    it('UPHOLD_ORIGINAL should set status to COMPLETED', () => {
      // Find the UPHOLD_ORIGINAL block
      const upholdBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('UPHOLD_ORIGINAL)'),
        adminMatchServiceCode.indexOf('UPHOLD_DISPUTER')
      );
      expect(upholdBlock).toContain('MatchStatus.COMPLETED');
      expect(upholdBlock).toContain('resultConfirmedAt');
    });

    it('UPHOLD_DISPUTER/CUSTOM_SCORE should set status to COMPLETED', () => {
      const block = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('UPHOLD_DISPUTER || action === DisputeResolutionAction.CUSTOM_SCORE'),
        adminMatchServiceCode.indexOf('VOID_MATCH)')
      );
      expect(block).toContain('MatchStatus.COMPLETED');
      expect(block).toContain('resultConfirmedAt');
    });

    it('AWARD_WALKOVER should set status to COMPLETED', () => {
      const block = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('AWARD_WALKOVER)'),
        adminMatchServiceCode.indexOf('DisputeResolutionAction.REJECT)')
      );
      expect(block).toContain('MatchStatus.COMPLETED');
      expect(block).toContain('resultConfirmedAt');
    });

    it('REJECT should set status to COMPLETED', () => {
      // Find the REJECT block — it's between REJECT) and the Log admin action comment
      const rejectStart = adminMatchServiceCode.indexOf('DisputeResolutionAction.REJECT)');
      const rejectEnd = adminMatchServiceCode.indexOf('// Log admin action', rejectStart);
      const block = adminMatchServiceCode.slice(rejectStart, rejectEnd);
      expect(block).toContain('MatchStatus.COMPLETED');
      expect(block).toContain('resultConfirmedAt');
    });

    it('VOID_MATCH should set status to VOID (not COMPLETED)', () => {
      const block = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('VOID_MATCH)'),
        adminMatchServiceCode.indexOf('AWARD_WALKOVER)')
      );
      expect(block).toContain('MatchStatus.VOID');
      expect(block).not.toContain('MatchStatus.COMPLETED');
    });
  });

  describe('BUG 2: V2 standings service used (not legacy V1)', () => {

    it('resolveDispute should use StandingsV2Service', () => {
      // The recalculation block after dispute resolution
      const recalcBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Recalculate standings, ratings, and Best 6 after dispute'),
        adminMatchServiceCode.indexOf('return this.getDisputeById')
      );
      expect(recalcBlock).toContain('StandingsV2Service');
      expect(recalcBlock).toContain('standingsV2Service');
    });

    it('resolveDispute should NOT use legacy standingsCalculationService', () => {
      const recalcBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Recalculate standings, ratings, and Best 6 after dispute'),
        adminMatchServiceCode.indexOf('return this.getDisputeById')
      );
      expect(recalcBlock).not.toContain("standingsCalculationService'");
    });

    it('editMatchResult should use StandingsV2Service', () => {
      const editBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Trigger rating and standings recalculation for completed'),
        adminMatchServiceCode.indexOf('Notify participants')
      );
      expect(editBlock).toContain('StandingsV2Service');
      expect(editBlock).toContain('standingsV2Service');
    });

    it('editMatchResult should NOT use legacy standingsCalculationService', () => {
      const editBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Trigger rating and standings recalculation for completed'),
        adminMatchServiceCode.indexOf('Notify participants')
      );
      expect(editBlock).not.toContain("standingsCalculationService'");
    });
  });

  describe('BUG 3: MatchResult records refreshed', () => {

    it('resolveDispute should delete then create MatchResult records', () => {
      const recalcBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Recalculate standings, ratings, and Best 6 after dispute'),
        adminMatchServiceCode.indexOf('return this.getDisputeById')
      );
      expect(recalcBlock).toContain('deleteMatchResults');
      expect(recalcBlock).toContain('createMatchResults');
      // delete must come before create
      const deleteIdx = recalcBlock.indexOf('deleteMatchResults');
      const createIdx = recalcBlock.indexOf('createMatchResults');
      expect(deleteIdx).toBeLessThan(createIdx);
    });

    it('editMatchResult should delete then create MatchResult records', () => {
      const editBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Trigger rating and standings recalculation for completed'),
        adminMatchServiceCode.indexOf('Notify participants')
      );
      expect(editBlock).toContain('deleteMatchResults');
      expect(editBlock).toContain('createMatchResults');
    });

    it('should flag match for admin review if MatchResult creation fails', () => {
      const recalcBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Recalculate standings, ratings, and Best 6 after dispute'),
        adminMatchServiceCode.indexOf('return this.getDisputeById')
      );
      expect(recalcBlock).toContain('requiresAdminReview: true');
    });
  });

  describe('BUG 4: REQUEST_MORE_INFO dispute status', () => {

    it('should set UNDER_REVIEW for REQUEST_MORE_INFO (not RESOLVED)', () => {
      const statusBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Determine final dispute status'),
        adminMatchServiceCode.indexOf('await prisma.$transaction')
      );
      expect(statusBlock).toContain('REQUEST_MORE_INFO');
      expect(statusBlock).toContain('UNDER_REVIEW');
    });
  });

  describe('BUG 5: REQUEST_MORE_INFO resolvedAt', () => {

    it('should conditionally exclude resolvedAt for REQUEST_MORE_INFO', () => {
      const updateBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Update dispute'),
        adminMatchServiceCode.indexOf('Handle different resolution actions')
      );
      // resolvedAt should be wrapped in a conditional that checks for REQUEST_MORE_INFO
      expect(updateBlock).toContain('REQUEST_MORE_INFO');
      expect(updateBlock).toMatch(/action\s*!==\s*DisputeResolutionAction\.REQUEST_MORE_INFO.*resolvedAt/s);
    });
  });

  describe('Recalculation order', () => {

    it('should recalculate in correct order: MatchResult → Ratings → Best6 → V2 Standings', () => {
      const recalcBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('Recalculate standings, ratings, and Best 6 after dispute'),
        adminMatchServiceCode.indexOf('return this.getDisputeById')
      );
      const mrIdx = recalcBlock.indexOf('deleteMatchResults');
      const ratingsIdx = recalcBlock.indexOf('recalculateMatchRatings');
      const best6Idx = recalcBlock.indexOf('applyBest6ToDatabase');
      const v2Idx = recalcBlock.indexOf('recalculateDivisionStandings');

      expect(mrIdx).toBeLessThan(ratingsIdx);
      expect(ratingsIdx).toBeLessThan(best6Idx);
      expect(best6Idx).toBeLessThan(v2Idx);
    });
  });

  describe('REJECT included in recalculation list', () => {

    it('actionsRequiringRecalc should include REJECT', () => {
      const recalcList = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('actionsRequiringRecalc'),
        adminMatchServiceCode.indexOf('if (actionsRequiringRecalc.includes')
      );
      expect(recalcList).toContain('DisputeResolutionAction.REJECT');
    });

    it('audit trail should mark REJECT as triggering recalculation', () => {
      // triggeredRecalculation should only exclude REQUEST_MORE_INFO
      const auditBlock = adminMatchServiceCode.slice(
        adminMatchServiceCode.indexOf('triggeredRecalculation'),
        adminMatchServiceCode.indexOf('triggeredRecalculation') + 100
      );
      expect(auditBlock).toContain('REQUEST_MORE_INFO');
      expect(auditBlock).not.toContain('REJECT');
    });
  });
});
