import type { Request, Response } from 'express';
import { getDivisionStandings } from '../../services/standingsService';
import { sendSuccess, sendError } from '../../utils/response';

export async function getStandings(req: Request, res: Response) {
  try {
    const { divisionId, seasonId } = req.params;

    if (!divisionId || !seasonId) {
      return sendError(res, 'Division ID and Season ID are required', 400);
    }

    const standings = await getDivisionStandings(divisionId, seasonId);

    return sendSuccess(res, standings);
  } catch (error) {
    console.error('Error fetching standings:', error);
    return sendError(res, 'Failed to fetch standings', 500);
  }
}
