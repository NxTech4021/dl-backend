import { PrismaClient, RegistrationType } from '@prisma/client';

const prisma = new PrismaClient();

interface PlayerRegistrationData {
  playerId: string;
  seasonId: number;
  registrationType: 'PLAYER';
  divisionId?: number;
  flags?: number;
}

interface TeamRegistrationData {
  teamId: string;
  seasonId: number;
  registrationType: 'TEAM';
  divisionId?: number;
  flags?: number;
}

type RegistrationData = PlayerRegistrationData | TeamRegistrationData;


// BUSINESS LOGIC SERVICES


// Business Logic: Registration creation with comprehensive validation
export const createRegistration = async (data: RegistrationData) => {
  const { seasonId, registrationType, divisionId, flags = 0 } = data;

  // Business Rule: Verify season exists and is open for registration
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      league: { select: { name: true } }
    }
  });
  if (!season) {
    throw new Error(`Season with ID ${seasonId} not found.`);
  }

  // Business Rule: Check if registration period is still open
  const now = new Date();
  if (now > season.lastRegistration) {
    throw new Error('Registration period has ended for this season.');
  }

  // Business Rule: Season must be accepting registrations
  if (season.status !== 'REGISTRATION_OPEN' && season.status !== 'UPCOMING') {
    throw new Error('Season is not currently accepting registrations.');
  }

  // Business Rule: Validate division if provided
  if (divisionId) {
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      include: {
        _count: { select: { registrations: true } }
      }
    });
    
    if (!division) {
      throw new Error(`Division with ID ${divisionId} not found.`);
    }

    if (division.seasonId !== seasonId) {
      throw new Error('Division does not belong to the specified season.');
    }

    // Business Rule: Check division capacity
    if (division.maxParticipants && division._count.registrations >= division.maxParticipants) {
      throw new Error('Division is at maximum capacity.');
    }
  }

  if (registrationType === 'PLAYER') {
    return await createPlayerRegistration(data as PlayerRegistrationData, season);
  } else {
    return await createTeamRegistration(data as TeamRegistrationData, season);
  }
};

// Business Logic: Player registration with validation
const createPlayerRegistration = async (data: PlayerRegistrationData, season: any) => {
  const { playerId, seasonId, divisionId, flags } = data;

  // Business Rule: Verify player exists
  const player = await prisma.user.findUnique({
    where: { id: playerId },
  });
  if (!player) {
    throw new Error(`Player with ID ${playerId} not found.`);
  }

  // Business Rule: Check for duplicate registration
  const existingRegistration = await prisma.seasonRegistration.findFirst({
    where: {
      playerId,
      seasonId,
      isActive: true,
    },
  });
  if (existingRegistration) {
    throw new Error('Player is already registered for this season.');
  }

  // Business Rule: Check if player has active registrations in overlapping seasons
  if (season.startDate && season.endDate) {
    const overlappingRegistrations = await prisma.seasonRegistration.findMany({
      where: {
        playerId,
        isActive: true,
        season: {
          OR: [
            {
              AND: [
                { startDate: { lte: season.endDate } },
                { endDate: { gte: season.startDate } }
              ]
            }
          ]
        }
      },
      include: {
        season: { select: { name: true, league: { select: { name: true } } } }
      }
    });

    if (overlappingRegistrations.length > 0) {
      const conflictingSeason = overlappingRegistrations[0].season;
      throw new Error(`Player is already registered for overlapping season: ${conflictingSeason.name} in ${conflictingSeason.league.name}`);
    }
  }

  // Business Logic: Create player registration
  return prisma.seasonRegistration.create({
    data: {
      playerId,
      seasonId,
      registrationType: 'PLAYER',
      divisionId,
      flags,
    },
    include: {
      player: { select: { name: true, email: true } },
      season: { select: { name: true, entryFee: true } },
    },
  });
};

// Business Logic: Team registration with validation
const createTeamRegistration = async (data: TeamRegistrationData, season: any) => {
  const { teamId, seasonId, divisionId, flags } = data;

  // Business Rule: Verify team exists
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: { select: { userId: true } }
    }
  });
  if (!team) {
    throw new Error(`Team with ID ${teamId} not found.`);
  }

  // Business Rule: Team must have members
  if (team.members.length === 0) {
    throw new Error('Team must have at least one member to register.');
  }

  // Business Rule: Check for duplicate registration
  const existingRegistration = await prisma.seasonRegistration.findFirst({
    where: {
      teamId,
      seasonId,
      isActive: true,
    },
  });
  if (existingRegistration) {
    throw new Error('Team is already registered for this season.');
  }

  // Business Rule: Check if any team members have conflicting registrations
  const memberIds = team.members.map(m => m.userId);
  const conflictingRegistrations = await prisma.seasonRegistration.findMany({
    where: {
      playerId: { in: memberIds },
      seasonId,
      isActive: true,
    },
    include: {
      player: { select: { name: true } }
    }
  });

  if (conflictingRegistrations.length > 0) {
    const conflictingPlayer = conflictingRegistrations[0].player;
    throw new Error(`Team member ${conflictingPlayer?.name} is already individually registered for this season.`);
  }

  // Business Logic: Create team registration
  return prisma.seasonRegistration.create({
    data: {
      teamId,
      seasonId,
      registrationType: 'TEAM',
      divisionId,
      flags,
    },
    include: {
      team: {
        select: {
          name: true,
          captain: { select: { name: true, email: true } },
        },
      },
      season: { select: { name: true, entryFee: true } },
    },
  });
};

// Business Logic: Registration update with validation
export const updateRegistration = async (id: number, data: { divisionId?: number; flags?: number; isActive?: boolean }) => {
  // Business Rule: Verify registration exists
  const registration = await prisma.seasonRegistration.findUnique({
    where: { id },
    include: {
      season: { select: { status: true, lastRegistration: true } }
    }
  });
  
  if (!registration) {
    throw new Error(`Registration with ID ${id} not found.`);
  }

  // Business Rule: Cannot modify completed season registrations
  if (registration.season.status === 'COMPLETED') {
    throw new Error('Cannot modify registrations for completed seasons.');
  }

  // Business Rule: Validate division change if provided
  if (data.divisionId && data.divisionId !== registration.divisionId) {
    const division = await prisma.division.findUnique({
      where: { id: data.divisionId },
      include: {
        _count: { select: { registrations: true } }
      }
    });
    
    if (!division) {
      throw new Error(`Division with ID ${data.divisionId} not found.`);
    }

    if (division.seasonId !== registration.seasonId) {
      throw new Error('Division does not belong to the registration season.');
    }

    // Check division capacity
    if (division.maxParticipants && division._count.registrations >= division.maxParticipants) {
      throw new Error('Target division is at maximum capacity.');
    }
  }

  // Business Logic: Update registration
  return prisma.seasonRegistration.update({
    where: { id },
    data,
    include: {
      player: { select: { name: true, email: true } },
      team: { select: { name: true } },
      season: { select: { name: true } },
      division: { select: { name: true } },
    },
  });
};

// Business Logic: Registration cancellation with validation
export const cancelRegistration = async (id: number) => {
  // Business Rule: Verify registration exists
  const registration = await prisma.seasonRegistration.findUnique({
    where: { id },
    include: {
      season: { select: { status: true, startDate: true } }
    }
  });
  
  if (!registration) {
    throw new Error(`Registration with ID ${id} not found.`);
  }

  if (!registration.isActive) {
    throw new Error('Registration is already cancelled.');
  }

  // Business Rule: Cannot cancel after season has started
  const now = new Date();
  if (registration.season.startDate && now >= registration.season.startDate) {
    throw new Error('Cannot cancel registration after season has started.');
  }

  // Business Logic: Cancel registration
  return prisma.seasonRegistration.update({
    where: { id },
    data: { isActive: false },
  });
};

// Business Logic: Registration deletion with constraints
export const deleteRegistration = async (id: number) => {
  // Business Rule: Verify registration exists
  const registration = await prisma.seasonRegistration.findUnique({
    where: { id },
    include: {
      season: { select: { status: true } }
    }
  });
  
  if (!registration) {
    throw new Error(`Registration with ID ${id} not found.`);
  }

  // Business Rule: Cannot delete if season is in progress or completed
  if (registration.season.status === 'IN_PROGRESS' || registration.season.status === 'COMPLETED') {
    throw new Error('Cannot delete registrations for active or completed seasons.');
  }

  // Business Logic: Delete registration
  return prisma.seasonRegistration.delete({
    where: { id },
  });
};

// Business Logic: Bulk registration operations
export const bulkUpdateRegistrationDivisions = async (seasonId: number, assignments: Array<{registrationId: number, divisionId: number}>) => {
  // Verify season exists
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
  });
  
  if (!season) {
    throw new Error(`Season with ID ${seasonId} not found.`);
  }

  if (season.status === 'COMPLETED') {
    throw new Error('Cannot update divisions for completed seasons.');
  }

  // Validate all assignments first
  for (const assignment of assignments) {
    const division = await prisma.division.findUnique({
      where: { id: assignment.divisionId },
    });
    
    if (!division) {
      throw new Error(`Division with ID ${assignment.divisionId} not found.`);
    }
    
    if (division.seasonId !== seasonId) {
      throw new Error(`Division ${assignment.divisionId} does not belong to season ${seasonId}.`);
    }
  }

  // Execute bulk update in transaction
  return prisma.$transaction(
    assignments.map(assignment => 
      prisma.seasonRegistration.update({
        where: { id: assignment.registrationId },
        data: { divisionId: assignment.divisionId },
      })
    )
  );
};