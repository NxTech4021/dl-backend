import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';


const prisma = new PrismaClient();
/**
 * Create Category
 */
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { leagueId, name, genderRestriction, matchFormat, maxPlayers, maxTeams, categoryOrder } = req.body;

    if (!leagueId) {
      return res.status(400).json(new ApiResponse(false, 400, null, "League ID is required"));
    }
    if (!name) {
      return res.status(400).json(new ApiResponse(false, 400, null, "Category name is required"));
    }

    const newCategory = await prisma.category.create({
      data: {
        leagueId,
        name,
        genderRestriction,
        matchFormat,
        maxPlayers,
        maxTeams,
        categoryOrder
      }
    });

    return res.status(201).json(new ApiResponse(true, 201, newCategory, "Category created successfully"));
  } catch (error: any) {
    console.error("Error creating category:", error);
    return res.status(500).json(new ApiResponse(false, 500, null, "Error creating category"));
  }
};


/**
 * Get Categories by League
 */
export const getCategoriesByLeague = async (req: Request, res: Response) => {
  try {
    const leagueId = req.params.leagueId;
    if (!leagueId) {
      return res.status(400).json(new ApiResponse(false, 400, null, "League ID is required"));
    }

    const categories = await prisma.category.findMany({
      where: { leagueId },
      orderBy: { categoryOrder: 'asc' }
    });

    return res.status(200).json(new ApiResponse(true, 200, categories, "Categories fetched successfully"));
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    return res.status(500).json(new ApiResponse(false, 500, null, "Error fetching categories"));
  }
};


/**
 * Update Category
 */
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = req.body;

    const updatedCategory = await prisma.category.update({
      where: { id },
      data
    });

    return res.status(200).json(new ApiResponse(true, 200, updatedCategory, "Category updated successfully"));
  } catch (error: any) {
    console.error("Error updating category:", error);
    return res.status(500).json(new ApiResponse(false, 500, null, "Error updating category"));
  }
};


/**
 * Delete Category
 */
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    await prisma.category.delete({
      where: { id }
    });

    return res.status(200).json(new ApiResponse(true, 200, null, "Category deleted successfully"));
  } catch (error: any) {
    console.error("Error deleting category:", error);
    return res.status(500).json(new ApiResponse(false, 500, null, "Error deleting category"));
  }
};
