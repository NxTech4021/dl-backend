import { Request, Response } from 'express';
import * as sportService from '../services/sportService';
import { sendSuccess, sendError } from '../utils/response';

export const getSports = async (req: Request, res: Response) => {
  try {
    const sports = await sportService.getAllSports();
    return sendSuccess(res, { sports }, "Sports fetched successfully");
  } catch (error) {
    console.error("Fetch sports error:", error);
    return sendError(res, "Something went wrong", 500);
  }
};
