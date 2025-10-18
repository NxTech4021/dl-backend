import { Request, Response } from 'express';
import * as sportService from '../services/sportService';
import { ApiResponse } from '../utils/ApiResponse';

export const getSports = async (req: Request, res: Response) => {
  try {
    const sports = await sportService.getAllSports();
    res.status(200).json(new ApiResponse(true, 200, { sports }, "Sports fetched successfully"));
  } catch (error) {
    console.error("Fetch sports error:", error);
    res.status(500).json(new ApiResponse(false, 500, null, "Something went wrong"));
  }
};
