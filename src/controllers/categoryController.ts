import { prisma } from "../lib/prisma";
import { Request, Response } from 'express';
import { Prisma, GenderRestriction, GameType, GenderType } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';

interface CreateCategoryBody {
  seasonId?: string;
  name?: string;
  genderRestriction?: string;
  matchFormat?: string;
  categoryOrder?: number;
  game_type?: string;
  gender_category?: string;
  isActive?: boolean;
}

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { 
      seasonId, 
      name, 
      genderRestriction, 
      matchFormat, 
      categoryOrder, 
      game_type, 
      gender_category,
      isActive,
    } = req.body as CreateCategoryBody;

    console.log("Payload received", req.body);
    
    if (!name) {
      return res.status(400).json(new ApiResponse(false, 400, null, "Category name is required"));
    }

    // Validate and cast enum types
    let validatedGenderRestriction: GenderRestriction | undefined;
    if (genderRestriction && Object.values(GenderRestriction).includes(genderRestriction as GenderRestriction)) {
      validatedGenderRestriction = genderRestriction as GenderRestriction;
    }

    let validatedGameType: GameType | null | undefined;
    if (game_type !== undefined) {
      if (game_type && Object.values(GameType).includes(game_type as GameType)) {
        validatedGameType = game_type as GameType;
      } else {
        validatedGameType = null;
      }
    }

    // Map gender_category from request or from genderRestriction
    let mappedGenderCategory: GenderType | null | undefined = undefined;
    if (gender_category !== undefined) {
      if (gender_category && Object.values(GenderType).includes(gender_category as GenderType)) {
        mappedGenderCategory = gender_category as GenderType;
      } else {
        mappedGenderCategory = null;
      }
    } else if (genderRestriction) {
      // Fall back to mapping from genderRestriction if gender_category not provided
      if (genderRestriction === 'MALE') {
        mappedGenderCategory = GenderType.MALE;
      } else if (genderRestriction === 'FEMALE') {
        mappedGenderCategory = GenderType.FEMALE;
      } else if (genderRestriction === 'MIXED') {
        mappedGenderCategory = GenderType.MIXED;
      }
    }

    const categoryData: Prisma.CategoryCreateInput = {
      name: name ?? null,
      ...(validatedGenderRestriction !== undefined && { genderRestriction: validatedGenderRestriction }),
      ...(matchFormat !== undefined && { matchFormat: matchFormat ?? null }),
      ...(categoryOrder !== undefined && { categoryOrder }),
      ...(validatedGameType !== undefined && { gameType: validatedGameType }),
      ...(mappedGenderCategory !== undefined && { genderCategory: mappedGenderCategory }),
      ...(isActive !== undefined && { isActive }),
      ...(seasonId && {
        seasons: {
          connect: [{ id: seasonId }]
        }
      })
    };

    const newCategory = await prisma.category.create({
      data: categoryData,
      include: {
        seasons: {
          select: {
            id: true,
            name: true,
            leagues: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    return res.status(201).json(new ApiResponse(true, 201, newCategory, "Category created successfully"));
  } catch (error) {
    console.error("Error creating category:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return res.status(409).json(
          new ApiResponse(false, 409, null, "A category with this name already exists")
        );
      }
      if (error.code === "P2003") {
        return res.status(400).json(
          new ApiResponse(false, 400, null, "Season ID is invalid")
        );
      }
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error creating category")
    );
  }
};

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
         seasons: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { categoryOrder: 'asc' }
    });

    return res.status(200).json(
      new ApiResponse(true, 200, categories, "Categories fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching categories")
    );
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Category ID is required")
      );
    }

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        seasons: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!category) {
      return res.status(404).json(
        new ApiResponse(false, 404, null, "Category not found")
      );
    }

    return res.status(200).json(
      new ApiResponse(true, 200, category, "Category fetched successfully")
    );
  } catch (error) {
    console.error("Error fetching category:", error);
    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error fetching category")
    );
  }
};


interface UpdateCategoryBody {
  seasonId?: string;
  name?: string;
  genderRestriction?: string;
  matchFormat?: string;
  categoryOrder?: number;
  game_type?: string;
  gender_category?: string;
}

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { seasonId, ...data } = req.body as UpdateCategoryBody;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Category ID is required")
      );
    }

    // Validate and cast enum types
    let validatedGenderRestriction: GenderRestriction | undefined;
    if (data.genderRestriction !== undefined) {
      if (data.genderRestriction && Object.values(GenderRestriction).includes(data.genderRestriction as GenderRestriction)) {
        validatedGenderRestriction = data.genderRestriction as GenderRestriction;
      }
    }

    let validatedGameType: GameType | null | undefined;
    if (data.game_type !== undefined) {
      if (data.game_type && Object.values(GameType).includes(data.game_type as GameType)) {
        validatedGameType = data.game_type as GameType;
      } else {
        validatedGameType = null;
      }
    }

    // Map genderRestriction to gender_category automatically if genderRestriction is being updated
    let mappedGenderCategory: GenderType | null | undefined = undefined;
    if (data.gender_category !== undefined) {
      if (data.gender_category && Object.values(GenderType).includes(data.gender_category as GenderType)) {
        mappedGenderCategory = data.gender_category as GenderType;
      } else {
        mappedGenderCategory = null;
      }
    }
    
    if (data.genderRestriction) {
      if (data.genderRestriction === 'MALE') {
        mappedGenderCategory = GenderType.MALE;
      } else if (data.genderRestriction === 'FEMALE') {
        mappedGenderCategory = GenderType.FEMALE;
      } else if (data.genderRestriction === 'MIXED') {
        mappedGenderCategory = GenderType.MIXED;
      } else if (data.genderRestriction === 'OPEN') {
        mappedGenderCategory = GenderType.MIXED;
      }
    }

    // Remove gender_category from data if we're setting it from genderRestriction
    const { gender_category: _, ...updateData } = data;

    const updateDataWithRelations: Prisma.CategoryUpdateInput = {};
    
    if (updateData.name !== undefined) updateDataWithRelations.name = updateData.name ?? null;
    if (validatedGenderRestriction !== undefined) updateDataWithRelations.genderRestriction = validatedGenderRestriction;
    if (updateData.matchFormat !== undefined) updateDataWithRelations.matchFormat = updateData.matchFormat ?? null;
    if (updateData.categoryOrder !== undefined) updateDataWithRelations.categoryOrder = updateData.categoryOrder;
    if (validatedGameType !== undefined) updateDataWithRelations.gameType = validatedGameType;
    if (mappedGenderCategory !== undefined) updateDataWithRelations.genderCategory = mappedGenderCategory;

    if (seasonId !== undefined) {
      if (seasonId) {
        updateDataWithRelations.seasons = {
          set: [{ id: seasonId }]
        };
      } else {
        updateDataWithRelations.seasons = {
          set: []
        };
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateDataWithRelations,
      include: {
        seasons: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.status(200).json(
      new ApiResponse(true, 200, updatedCategory, "Category updated successfully")
    );
  } catch (error) {
    console.error("Error updating category:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).json(
          new ApiResponse(false, 404, null, "Category not found")
        );
      }
      if (error.code === "P2003") {
        return res.status(400).json(
          new ApiResponse(false, 400, null, "Season ID is invalid")
        );
      }
    }

    return res.status(500).json(
      new ApiResponse(false, 500, null, "Error updating category")
    );
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Category ID is required")
      );
    }

    const existingCategory = await prisma.category.findUnique({
      where: { id },
      include: {
        seasons: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!existingCategory) {
      console.log("❌ No category found with ID:", id);
      return res.status(404).json(
        new ApiResponse(false, 404, null, "Category not found")
      );
    }
    
    if (existingCategory.seasons && existingCategory.seasons.length > 0) {
      const season = existingCategory.seasons[0];
      if (season) {
        return res.status(400).json(
          new ApiResponse(
            false,
            400,
            null,
            `Cannot delete category: It is linked to season "${season.name}"`
          )
        );
      }
    }

    await prisma.category.delete({
      where: { id },
    });

    return res
      .status(200)
      .json(new ApiResponse(true, 200, null, "Category deleted successfully"));
  } catch (error: unknown) {
    console.error("🔥 Error deleting category:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      console.log("❌ Prisma foreign key constraint error:", error);
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          "Cannot delete category: It is being used by a season"
        )
      );
    }
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(500).json(
        new ApiResponse(false, 500, null, "Database error deleting category")
      );
    }

    console.log("❌ General server error while deleting category");
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Error deleting category"));
  }
};

