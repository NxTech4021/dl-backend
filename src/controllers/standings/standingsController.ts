import type { Request, Response } from 'express';
import { getDivisionStandings } from '../services/standings/standingsService';

export async function getStandings(req: Request, res: Response) {
  try {
    const { divisionId, seasonId } = req.params;

    if (!divisionId || !seasonId) {
      return res.status(400).json({
        success: false,
        message: 'Division ID and Season ID are required',
      });
    }

    const standings = await getDivisionStandings(divisionId, seasonId);

    return res.status(200).json({
      success: true,
      data: standings,
    });
  } catch (error) {
    console.error('Error fetching standings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch standings',
    });
  }
}