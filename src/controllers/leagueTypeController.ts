import { prisma } from "../lib/prisma";
// import { Request, Response } from 'express';
// import { PrismaClient, LeagueTypeType, Gender } from '@prisma/client';
// import * as leagueTypeService from '../services/leagueTypeService';
// import { ApiResponse } from '../utils/ApiResponse';

// const prisma = new PrismaClient();

// export const getLeagueTypes = async (req: Request, res: Response) => {
//   try {
//     const { name, type, gender } = req.query;

//     // Build where clause
//     const where: any = {};
//     if (name) {
//       where.name = { contains: name as string, mode: 'insensitive' };
//     }
//     if (type) {
//       where.type = type as LeagueTypeType;
//     }
//     if (gender) {
//       where.gender = gender as Gender;
//     }

//     const leagueTypes = await prisma.leagueType.findMany({
//       where,
//       include: {
//         _count: {
//           select: { seasons: true }
//         }
//       },
//       orderBy: [
//         { type: 'asc' },
//         { gender: 'asc' },
//         { name: 'asc' }
//       ]
//     });

//     // Transform for frontend
//     const transformedLeagueTypes = leagueTypes.map(leagueType => ({
//       id: leagueType.id,
//       name: leagueType.name,
//       type: leagueType.type,
//       gender: leagueType.gender,
//       seasonsCount: leagueType._count.seasons,
//       createdAt: leagueType.createdAt,
//       updatedAt: leagueType.updatedAt
//     }));

//     if (transformedLeagueTypes.length === 0) {
//       return res.status(200).json(
//         new ApiResponse(true, 200, [], "No league types found")
//       );
//     }

//     return res.status(200).json(
//       new ApiResponse(true, 200, transformedLeagueTypes, "League types fetched successfully")
//     );
//   } catch (error) {
//     console.error("Error fetching league types:", error);
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error fetching league types")
//     );
//   }
// };

// export const getLeagueTypeById = async (req: Request, res: Response) => {
//   try {
//     const id = parseInt(req.params.id, 10);
//     if (isNaN(id)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, 'Invalid league type ID')
//       );
//     }

//     const leagueType = await prisma.leagueType.findUnique({
//       where: { id },
//       include: {
//         seasons: {
//           select: {
//             id: true,
//             name: true,
//             status: true,
//             startDate: true,
//             endDate: true
//           }
//         }
//       }
//     });

//     if (!leagueType) {
//       return res.status(404).json(
//         new ApiResponse(false, 404, null, 'League type not found')
//       );
//     }

//     // Transform for detailed view
//     const transformedLeagueType = {
//       id: leagueType.id,
//       name: leagueType.name,
//       type: leagueType.type,
//       gender: leagueType.gender,
//       seasons: leagueType.seasons,
//       seasonsCount: leagueType.seasons.length,
//       createdAt: leagueType.createdAt,
//       updatedAt: leagueType.updatedAt
//     };

//     return res.status(200).json(
//       new ApiResponse(true, 200, transformedLeagueType, "League type details fetched successfully")
//     );
//   } catch (error: any) {
//     console.error("Error fetching league type:", error);
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error fetching league type")
//     );
//   }
// };

// export const createLeagueType = async (req: Request, res: Response) => {
//   try {
//     const { name, type, gender } = req.body;

//     if (!name || !type || !gender) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, 'Missing required fields: name, type, gender')
//       );
//     }

//     if (!Object.values(LeagueTypeType).includes(type)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, `Invalid type provided. Must be one of: ${Object.values(LeagueTypeType).join(', ')}`)
//       );
//     }

//     if (!Object.values(Gender).includes(gender)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, `Invalid gender provided. Must be one of: ${Object.values(Gender).join(', ')}`)
//       );
//     }

//     // Use service for business logic
//     const newLeagueType = await leagueTypeService.createLeagueType({
//       name,
//       type,
//       gender,
//     });

//     return res.status(201).json(
//       new ApiResponse(true, 201, newLeagueType, "League type created successfully")
//     );
//   } catch (error: any) {
//     console.error("Create league type error:", error);
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error creating league type")
//     );
//   }
// };

// export const updateLeagueType = async (req: Request, res: Response) => {
//   try {
//     const id = parseInt(req.params.id, 10);
//     if (isNaN(id)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, 'Invalid league type ID')
//       );
//     }

//     const updateData = { ...req.body };
    
//     // Validate enums if provided
//     if (updateData.type && !Object.values(LeagueTypeType).includes(updateData.type)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, `Invalid type provided. Must be one of: ${Object.values(LeagueTypeType).join(', ')}`)
//       );
//     }

//     if (updateData.gender && !Object.values(Gender).includes(updateData.gender)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, `Invalid gender provided. Must be one of: ${Object.values(Gender).join(', ')}`)
//       );
//     }

//     // Use service for business logic
//     const updatedLeagueType = await leagueTypeService.updateLeagueType(id, updateData);
    
//     return res.status(200).json(
//       new ApiResponse(true, 200, updatedLeagueType, "League type updated successfully")
//     );
//   } catch (error: any) {
//     console.error("Error updating league type:", error);
//     if (error.message.includes('not found')) {
//       return res.status(404).json(
//         new ApiResponse(false, 404, null, error.message)
//       );
//     }
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error updating league type")
//     );
//   }
// };

// export const deleteLeagueType = async (req: Request, res: Response) => {
//   try {
//     const id = parseInt(req.params.id, 10);
//     if (isNaN(id)) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, 'Invalid league type ID')
//       );
//     }

//     // Use service for business logic
//     await leagueTypeService.deleteLeagueType(id);
    
//     return res.status(200).json(
//       new ApiResponse(true, 200, null, "League type deleted successfully")
//     );
//   } catch (error: any) {
//     console.error("Error deleting league type:", error);
//     if (error.message.includes('Cannot delete')) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, error.message)
//       );
//     } else if (error.message.includes('not found')) {
//       return res.status(404).json(
//         new ApiResponse(false, 404, null, error.message)
//       );
//     } else {
//       return res.status(500).json(
//         new ApiResponse(false, 500, null, "Error deleting league type")
//       );
//     }
//   }
// };
