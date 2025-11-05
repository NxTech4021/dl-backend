import { prisma } from "../lib/prisma";
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { 
      seasonId, 
      name, 
      genderRestriction, 
      matchFormat, 
      categoryOrder, 
      game_type, 
    } = req.body;

    console.log("Payload received", req.body);
    
    if (!name) {
      return res.status(400).json(new ApiResponse(false, 400, null, "Category name is required"));
    }

    // Map genderRestriction to gender_category automatically
    let mappedGenderCategory: 'MALE' | 'FEMALE' | 'MIXED' | null = null;
    if (genderRestriction) {
      if (genderRestriction === 'MALE') {
        mappedGenderCategory = 'MALE';
      } else if (genderRestriction === 'FEMALE') {
        mappedGenderCategory = 'FEMALE';
      } else if (genderRestriction === 'MIXED') {
        mappedGenderCategory = 'MIXED';
      }
    }

    const newCategory = await prisma.category.create({
      data: {
        name,
        genderRestriction,
        matchFormat,
        categoryOrder,
        game_type,          
        gender_category: mappedGenderCategory,
        ...(seasonId && {
          seasons: {
            connect: [{ id: seasonId }]
          }
        })
      },
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


export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { seasonId, ...data } = req.body;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Category ID is required")
      );
    }

    // Map genderRestriction to gender_category automatically if genderRestriction is being updated
    let mappedGenderCategory: string | null | undefined = data.gender_category;
    if (data.genderRestriction) {
      if (data.genderRestriction === 'MALE') {
        mappedGenderCategory = 'MALE';
      } else if (data.genderRestriction === 'FEMALE') {
        mappedGenderCategory = 'FEMALE';
      } else if (data.genderRestriction === 'MIXED') {
        mappedGenderCategory = 'MIXED';
      } else if (data.genderRestriction === 'OPEN') {
        mappedGenderCategory = 'MIXED';
      }
    }

    // Remove gender_category from data if we're setting it from genderRestriction
    const { gender_category: _, ...updateData } = data;

    const updateDataWithRelations: any = {
      ...updateData,
      gender_category: mappedGenderCategory,
    };

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
  } catch (error: any) {
    console.error("🔥 Error deleting category:", error);

    if (error.code === "P2003") {
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

    console.log("❌ General server error while deleting category");
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Error deleting category"));
  }
};

