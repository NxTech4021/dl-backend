import { prisma } from "../lib/prisma";
import { PrismaClient } from '@prisma/client';


interface TeamCreationData {
  name: string;
  description?: string;
  captainId: string;
}

interface TeamUpdateData {
  name?: string;
  description?: string;
  captainId?: string;
}

interface TeamMemberData {
  userId: string;
  role?: string;
}

// BUSINESS LOGIC SERVICES


// Business Logic: Team creation with validation
export const createTeam = async (data: TeamCreationData) => {
  const { name, description, captainId } = data;

  // Business Rule: Verify captain exists
  const captain = await prisma.user.findUnique({
    where: { id: captainId },
  });
  if (!captain) {
    throw new Error(`User with ID ${captainId} not found.`);
  }

  // Business Rule: Check if captain is already captain of another active team
  const existingTeam = await prisma.team.findFirst({
    where: { captainId },
  });
  if (existingTeam) {
    throw new Error('User is already captain of another team.');
  }

  // Business Rule: Check for duplicate team names
  const duplicateTeam = await prisma.team.findFirst({
    where: { 
      name: { equals: name, mode: 'insensitive' }
    }
  });
  if (duplicateTeam) {
    throw new Error(`A team with name "${name}" already exists.`);
  }

  // Business Logic: Create team and add captain as member in transaction
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        name,
        description,
        captainId,
      },
      include: {
        captain: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Add captain as team member with captain role
    await tx.teamMember.create({
      data: {
        teamId: team.id,
        userId: captainId,
        role: 'captain',
      },
    });

    return team;
  });
};

// Business Logic: Team update with validation
export const updateTeam = async (id: string, data: TeamUpdateData) => {
  // Business Rule: Verify team exists
  const team = await prisma.team.findUnique({
    where: { id },
  });
  
  if (!team) {
    throw new Error(`Team with ID ${id} not found.`);
  }

  // Business Rule: Check for duplicate team names if name is being updated
  if (data.name && data.name !== team.name) {
    const duplicateTeam = await prisma.team.findFirst({
      where: { 
        name: { equals: data.name, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (duplicateTeam) {
      throw new Error(`A team with name "${data.name}" already exists.`);
    }
  }

  // Business Logic: Handle captain change
  if (data.captainId && data.captainId !== team.captainId) {
    // Verify new captain exists
    const newCaptain = await prisma.user.findUnique({
      where: { id: data.captainId },
    });
    if (!newCaptain) {
      throw new Error(`User with ID ${data.captainId} not found.`);
    }

    // Business Rule: New captain can't already be captain of another team
    const existingTeam = await prisma.team.findFirst({
      where: { 
        captainId: data.captainId,
        id: { not: id }, 
      },
    });
    if (existingTeam) {
      throw new Error('User is already captain of another team.');
    }

    // Business Rule: New captain must be a member of this team
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: id,
        userId: data.captainId,
      }
    });
    if (!membership) {
      throw new Error('New captain must be a member of the team.');
    }

    // Business Logic: Update team member roles in transaction
    return prisma.$transaction(async (tx) => {
      // Update old captain to member
      await tx.teamMember.updateMany({
        where: {
          teamId: id,
          userId: team.captainId,
        },
        data: {
          role: 'member',
        },
      });

      // Update new captain role
      await tx.teamMember.updateMany({
        where: {
          teamId: id,
          userId: data.captainId,
        },
        data: {
          role: 'captain',
        },
      });

      // Update team
      return tx.team.update({
        where: { id },
        data,
        include: {
          captain: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });
    });
  }

  // Business Logic: Simple update (no captain change)
  return prisma.team.update({
    where: { id },
    data,
    include: {
      captain: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
};

// Business Logic: Add team member with validation
export const addTeamMember = async (teamId: string, data: TeamMemberData) => {
  const { userId, role = 'member' } = data;

  // Business Rule: Verify team exists
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team) {
    throw new Error(`Team with ID ${teamId} not found.`);
  }

  // Business Rule: Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new Error(`User with ID ${userId} not found.`);
  }

  // Business Rule: Check if user is already a member
  const existingMember = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
  });
  if (existingMember) {
    throw new Error('User is already a member of this team.');
  }

  // Business Rule: Can't add someone as captain if they're not the team captain
  if (role === 'captain' && team.captainId !== userId) {
    throw new Error('Only the team captain can have captain role.');
  }

  // Business Rule: Check if user is captain of another team
  if (role === 'captain') {
    const otherTeam = await prisma.team.findFirst({
      where: {
        captainId: userId,
        id: { not: teamId }
      }
    });
    if (otherTeam) {
      throw new Error('User is already captain of another team.');
    }
  }

  // Business Logic: Add team member
  return prisma.teamMember.create({
    data: {
      teamId,
      userId,
      role,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
    },
  });
};

// Business Logic: Remove team member with validation
export const removeTeamMember = async (teamId: string, userId: string) => {
  // Business Rule: Verify team exists
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team) {
    throw new Error(`Team with ID ${teamId} not found.`);
  }

  // Business Rule: Cannot remove captain
  if (team.captainId === userId) {
    throw new Error('Cannot remove team captain. Transfer captaincy first.');
  }

  // Business Rule: Verify membership
  const member = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
  });

  if (!member) {
    throw new Error('User is not a member of this team.');
  }

  // Business Rule: Check if team has active registrations and this would leave team too small
  const registrationCount = await prisma.seasonRegistration.count({
    where: {
      teamId,
      isActive: true,
      season: {
        status: {
          in: ['UPCOMING', 'REGISTRATION_OPEN', 'IN_PROGRESS']
        }
      }
    }
  });

  if (registrationCount > 0) {
    const memberCount = await prisma.teamMember.count({
      where: { teamId }
    });

    if (memberCount <= 2) { // Would leave only captain
      throw new Error('Cannot remove member: team must have at least 2 members for active registrations.');
    }
  }

  // Business Logic: Remove team member
  return prisma.teamMember.delete({
    where: { id: member.id },
  });
};

// Business Logic: Update team member role with validation
export const updateTeamMember = async (teamId: string, userId: string, data: { role: string }) => {
  // Business Rule: Verify team exists
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });
  if (!team) {
    throw new Error(`Team with ID ${teamId} not found.`);
  }

  // Business Rule: Verify membership
  const member = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
  });

  if (!member) {
    throw new Error('User is not a member of this team.');
  }

  // Business Rule: Can't change to captain role unless user is the team captain
  if (data.role === 'captain' && team.captainId !== userId) {
    throw new Error('Only the team captain can have captain role.');
  }

  // Business Logic: Update member role
  return prisma.teamMember.update({
    where: { id: member.id },
    data,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
};

// Business Logic: Team deletion with constraint checking
export const deleteTeam = async (id: string) => {
  // Business Rule: Check if team has active registrations
  const activeRegistrationCount = await prisma.seasonRegistration.count({
    where: { 
      teamId: id,
      isActive: true,
      season: {
        status: {
          in: ['UPCOMING', 'REGISTRATION_OPEN', 'IN_PROGRESS']
        }
      }
    },
  });

  if (activeRegistrationCount > 0) {
    throw new Error('Cannot delete a team with active season registrations.');
  }

  // Business Rule: Check if team has any historical registrations
  const totalRegistrationCount = await prisma.seasonRegistration.count({
    where: { teamId: id },
  });

  if (totalRegistrationCount > 0) {
    throw new Error('Cannot delete a team with historical registrations. Consider deactivating instead.');
  }

  // Business Logic: Delete team and cascade to members
  return prisma.team.delete({
    where: { id },
  });
};

// Business Logic: Advanced team operations
export const transferCaptaincy = async (teamId: string, newCaptainId: string) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    throw new Error(`Team with ID ${teamId} not found.`);
  }

  // Verify new captain is a team member
  const membership = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId: newCaptainId,
    }
  });

  if (!membership) {
    throw new Error('New captain must be a member of the team.');
  }

  // Check if new captain is already captain of another team
  const existingCaptaincy = await prisma.team.findFirst({
    where: {
      captainId: newCaptainId,
      id: { not: teamId }
    }
  });

  if (existingCaptaincy) {
    throw new Error('User is already captain of another team.');
  }

  // Transfer captaincy in transaction
  return prisma.$transaction(async (tx) => {
    // Update old captain role to member
    await tx.teamMember.updateMany({
      where: {
        teamId,
        userId: team.captainId,
      },
      data: { role: 'member' },
    });

    // Update new captain role
    await tx.teamMember.updateMany({
      where: {
        teamId,
        userId: newCaptainId,
      },
      data: { role: 'captain' },
    });

    // Update team captain
    return tx.team.update({
      where: { id: teamId },
      data: { captainId: newCaptainId },
    });
  });
};