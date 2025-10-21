import { Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { ApiResponse } from '../utils/ApiResponse';


const prisma = new PrismaClient();

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { 
      leagueIds, 
      name, 
      genderRestriction, 
      matchFormat, 
      categoryOrder, 
      game_type, 
      gender_category 
    } = req.body;

    console.log(" payload received", req.body)
    
  
    // Validate leagueIds if provided
    if (leagueIds && (!Array.isArray(leagueIds) || leagueIds.length === 0)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "LeagueIds must be an array with at least one league")
      );
    }

    if (!name) {
      return res.status(400).json(new ApiResponse(false, 400, null, "Category name is required"));
    }

      const mappedGenderCategory =
      gender_category === "MEN"
        ? "MALE"
        : gender_category === "WOMEN"
        ? "FEMALE"
        : "MIXED";

    const leagueConnections = leagueIds?.length ? {
      leagues: {
        connect: leagueIds.map((id: string) => ({ id }))
      }
    } : {};

    const newCategory = await prisma.category.create({
      data: {
        name,
        genderRestriction,
        matchFormat,
        categoryOrder,
        game_type,          
        gender_category: mappedGenderCategory,
        ...leagueConnections
      },
      include: {
        leagues: true,
        seasons: true
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
          new ApiResponse(false, 400, null, "One or more league IDs are invalid")
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
        leagues: {
          select: {
            id: true,
            name: true,
          }
        },
        seasons: {
          select: {
            id: true,
            name: true,
          }
        }
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
        leagues: {
          select: {
            id: true,
            name: true,
          }
        },
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

export const getCategoriesByLeague = async (req: Request, res: Response) => {
  try {
    const { leagueId } = req.params;
    
    if (!leagueId) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "League ID is required")
      );
    }

    const categories = await prisma.category.findMany({
      where: {
        leagues: {
          some: {
            id: leagueId
          }
        }
      },
      include: {
        leagues: true,
        seasons: {
          select: {
            id: true,
            name: true,
          }
        }
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


export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { leagueIds, ...data } = req.body;

    if (!id) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "Category ID is required")
      );
    }

    if (leagueIds && (!Array.isArray(leagueIds) || leagueIds.length === 0)) {
      return res.status(400).json(
        new ApiResponse(false, 400, null, "LeagueIds must be an array with at least one league")
      );
    }

    const mappedGenderCategory =
      data.gender_category === "MEN"
        ? "MALE"
        : data.gender_category === "WOMEN"
        ? "FEMALE"
        : data.gender_category;

    // Prepare league connections if provided
    const leagueConnections = leagueIds ? {
      leagues: {
        set: leagueIds.map((id: string) => ({ id }))
      }
    } : {};

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...data,
        gender_category: mappedGenderCategory,
        ...leagueConnections
      },
      include: {
        leagues: true,
        seasons: {
          select: {
            id: true,
            name: true,
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
          new ApiResponse(false, 400, null, "One or more league IDs are invalid")
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
    });

    if (!existingCategory) {
      console.log("❌ No category found with ID:", id);
      return res.status(404).json(
        new ApiResponse(false, 404, null, "Category not found")
      );
    }

    const seasonsUsingCategory = await prisma.season.findMany({
      where: { 
        categories: {
          some: {
            id: id
          }
        }
      },
    });

    if (seasonsUsingCategory.length > 0) {
      return res.status(400).json(
        new ApiResponse(
          false,
          400,
          null,
          "Cannot delete category: It is being used in Seasons"
        )
      );
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
          "Cannot delete category: It is being used in Seasons"
        )
      );
    }

    console.log("❌ General server error while deleting category");
    return res
      .status(500)
      .json(new ApiResponse(false, 500, null, "Error deleting category"));
  }
};

