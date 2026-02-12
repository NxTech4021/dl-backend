// TODO: Implement team controller and services

// import { prisma } from "../lib/prisma";
// import { Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';
// import * as teamService from '../services/teamService';
// import { sendSuccess, sendError } from '../utils/response';


// export const getTeams = async (req: Request, res: Response) => {
//   try {
//     const { name, captainId } = req.query;

//     // Build where clause
//     const where: any = {};
//     if (name) {
//       where.name = { contains: name as string, mode: 'insensitive' };
//     }
//     if (captainId) {
//       where.captainId = captainId as string;
//     }

//     const teams = await prisma.team.findMany({
//       where,
//       include: {
//         captain: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             username: true
//           }
//         },
//         members: {
//           select: {
//             id: true,
//             role: true,
//             joinedAt: true,
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//                 username: true
//               }
//             }
//           }
//         },
//         _count: {
//           select: {
//             members: true,
//             registrations: true
//           }
//         }
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });


//     const transformedTeams = teams.map(team => ({
//       id: team.id,
//       name: team.name,
//       description: team.description,
//       captain: team.captain,
//       memberCount: team._count.members,
//       registrationCount: team._count.registrations,
//       members: team.members,
//       createdAt: team.createdAt,
//       updatedAt: team.updatedAt
//     }));

//     if (transformedTeams.length === 0) {
//       return res.status(200).json(
//         new ApiResponse(true, 200, [], "No teams found")
//       );
//     }

//     return res.status(200).json(
//       new ApiResponse(true, 200, transformedTeams, "Teams fetched successfully")
//     );
//   } catch (error) {
//     console.error("Error fetching teams:", error);
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error fetching teams")
//     );
//   }
// };

// export const getTeamById = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const team = await prisma.team.findUnique({
//       where: { id },
//       include: {
//         captain: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             username: true
//           }
//         },
//         members: {
//           include: {
//             user: {
//               select: {
//                 id: true,
//                 name: true,
//                 email: true,
//                 username: true
//               }
//             }
//           },
//           orderBy: {
//             joinedAt: 'asc'
//           }
//         },
//         registrations: {
//           include: {
//             season: {
//               select: {
//                 id: true,
//                 name: true,
//                 startDate: true,
//                 endDate: true,
//                 status: true
//               }
//             },
//             division: {
//               select: {
//                 id: true,
//                 name: true,
//                 rank: true
//               }
//             },
//             payment: {
//               select: {
//                 status: true,
//                 amount: true
//               }
//             }
//           },
//           orderBy: {
//             registeredAt: 'desc'
//           }
//         }
//       }
//     });

//     if (!team) {
//       return res.status(404).json(
//         new ApiResponse(false, 404, null, 'Team not found')
//       );
//     }

//     // Transform for detailed view
//     const transformedTeam = {
//       id: team.id,
//       name: team.name,
//       description: team.description,
//       captain: team.captain,
//       members: team.members,
//       registrations: team.registrations,
//       memberCount: team.members.length,
//       registrationCount: team.registrations.length,
//       createdAt: team.createdAt,
//       updatedAt: team.updatedAt
//     };

//     return res.status(200).json(
//       new ApiResponse(true, 200, transformedTeam, "Team details fetched successfully")
//     );
//   } catch (error: any) {
//     console.error("Error fetching team:", error);
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error fetching team")
//     );
//   }
// };

// export const createTeam = async (req: Request, res: Response) => {
//   try {
//     const { name, description, captainId } = req.body;

//     if (!name || !captainId) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, 'Missing required fields: name, captainId')
//       );
//     }

//     // Use service for complex business logic
//     const newTeam = await teamService.createTeam({
//       name,
//       description,
//       captainId,
//     });

//     return res.status(201).json(
//       new ApiResponse(true, 201, newTeam, "Team created successfully")
//     );
//   } catch (error: any) {
//     console.error("Create team error:", error);
//     if (error.message.includes('not found') || error.message.includes('already captain')) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, error.message)
//       );
//     }
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error creating team")
//     );
//   }
// };

// export const updateTeam = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const updateData = { ...req.body };

//     // Use service for complex business logic
//     const updatedTeam = await teamService.updateTeam(id, updateData);
    
//     return res.status(200).json(
//       new ApiResponse(true, 200, updatedTeam, "Team updated successfully")
//     );
//   } catch (error: any) {
//     console.error("Error updating team:", error);
//     if (error.message.includes('not found') || error.message.includes('already captain')) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, error.message)
//       );
//     }
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error updating team")
//     );
//   }
// };

// export const addTeamMember = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params; // team ID
//     const { userId, role } = req.body;

//     if (!userId) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, 'Missing required field: userId')
//       );
//     }

//     // Use service for complex business logic
//     const newMember = await teamService.addTeamMember(id, { userId, role });
    
//     return res.status(201).json(
//       new ApiResponse(true, 201, newMember, "Team member added successfully")
//     );
//   } catch (error: any) {
//     console.error("Add team member error:", error);
//     if (error.message.includes('not found') || error.message.includes('already a member')) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, error.message)
//       );
//     }
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error adding team member")
//     );
//   }
// };

// export const removeTeamMember = async (req: Request, res: Response) => {
//   try {
//     const { id, userId } = req.params; // team ID and user ID

//     // Use service for complex business logic
//     await teamService.removeTeamMember(id, userId);
    
//     return res.status(200).json(
//       new ApiResponse(true, 200, null, "Team member removed successfully")
//     );
//   } catch (error: any) {
//     console.error("Error removing team member:", error);
//     if (error.message.includes('not found') || error.message.includes('Cannot remove') || error.message.includes('not a member')) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, error.message)
//       );
//     }
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error removing team member")
//     );
//   }
// };

// export const updateTeamMember = async (req: Request, res: Response) => {
//   try {
//     const { id, userId } = req.params; // team ID and user ID
//     const { role } = req.body;

//     if (!role) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, 'Missing required field: role')
//       );
//     }

//     // Use service for complex business logic
//     const updatedMember = await teamService.updateTeamMember(id, userId, { role });
    
//     return res.status(200).json(
//       new ApiResponse(true, 200, updatedMember, "Team member updated successfully")
//     );
//   } catch (error: any) {
//     console.error("Error updating team member:", error);
//     if (error.message.includes('not found') || error.message.includes('not a member')) {
//       return res.status(400).json(
//         new ApiResponse(false, 400, null, error.message)
//       );
//     }
//     return res.status(500).json(
//       new ApiResponse(false, 500, null, "Error updating team member")
//     );
//   }
// };

// export const deleteTeam = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     // Use service for complex business logic
//     await teamService.deleteTeam(id);
    
//     return res.status(200).json(
//       new ApiResponse(true, 200, null, "Team deleted successfully")
//     );
//   } catch (error: any) {
//     console.error("Error deleting team:", error);
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
//         new ApiResponse(false, 500, null, "Error deleting team")
//       );
//     }
//   }
// };