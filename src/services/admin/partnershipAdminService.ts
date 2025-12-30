import { prisma } from "../../lib/prisma";

// Types for withdrawal request with full partnership details
export interface WithdrawalRequestAdmin {
  id: string;
  userId: string;
  reason: string;
  requestDate: Date;
  status: "PENDING" | "APPROVED" | "REJECTED";
  processedByAdminId: string | null;
  partnershipId: string | null;
  seasonId: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    username: string | null;
  } | null;
  processedByAdmin: {
    id: string;
    name: string | null;
    role: string;
  } | null;
  season: {
    id: string;
    name: string;
  } | null;
  partnership: {
    id: string;
    captainId: string;
    partnerId: string | null;
    status: string;
    dissolvedAt: Date | null;
    pairRating: number | null;
    captain: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      username: string | null;
    };
    partner: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      username: string | null;
    } | null;
    division: {
      id: string;
      name: string;
    } | null;
    // Standing data for the partnership
    standing: {
      rank: number;
      wins: number;
      losses: number;
      matchesPlayed: number;
      totalInDivision: number;
    } | null;
    // Successor partnership (INCOMPLETE created after dissolution)
    successors: {
      id: string;
      captainId: string;
      partnerId: string | null;
      status: string;
      createdAt: Date;
      captain: {
        id: string;
        name: string | null;
        image: string | null;
      };
      partner: {
        id: string;
        name: string | null;
        image: string | null;
      } | null;
    }[];
  } | null;
}

// Types for dissolved partnership with lifecycle
export interface DissolvedPartnershipLifecycle {
  id: string;
  captainId: string;
  partnerId: string | null;
  seasonId: string;
  divisionId: string | null;
  status: string;
  dissolvedAt: Date | null;
  createdAt: Date;
  captain: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    username: string | null;
  };
  partner: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    username: string | null;
  } | null;
  season: {
    id: string;
    name: string;
  };
  division: {
    id: string;
    name: string;
  } | null;
  // Standing data for the partnership (may be transferred to successor)
  standing: {
    rank: number;
    wins: number;
    losses: number;
    matchesPlayed: number;
    totalInDivision: number;
  } | null;
  // Withdrawal request that caused dissolution
  withdrawalRequest: {
    id: string;
    userId: string;
    reason: string;
    status: string;
    requestDate: Date;
    user: {
      id: string;
      name: string | null;
    };
  } | null;
  // Successor partnerships (INCOMPLETE/ACTIVE created after dissolution)
  successors: {
    id: string;
    captainId: string;
    partnerId: string | null;
    status: string;
    createdAt: Date;
    captain: {
      id: string;
      name: string | null;
      image: string | null;
    };
    partner: {
      id: string;
      name: string | null;
      image: string | null;
    } | null;
  }[];
}

// Stats for withdrawal requests
export interface WithdrawalRequestStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
  totalDissolved: number;
}

/**
 * Get all withdrawal requests with full partnership details
 */
export async function getAllWithdrawalRequests(filters?: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  seasonId?: string;
  search?: string;
}): Promise<WithdrawalRequestAdmin[]> {
  const whereClause: any = {};

  if (filters?.status) {
    whereClause.status = filters.status;
  }

  if (filters?.seasonId) {
    whereClause.seasonId = filters.seasonId;
  }

  // Search by user name
  if (filters?.search) {
    whereClause.user = {
      name: {
        contains: filters.search,
        mode: "insensitive",
      },
    };
  }

  const requests = await prisma.withdrawalRequest.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
        },
      },
      processedByAdmin: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      season: {
        select: {
          id: true,
          name: true,
        },
      },
      partnership: {
        include: {
          captain: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              username: true,
            },
          },
          partner: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              username: true,
            },
          },
          division: {
            select: {
              id: true,
              name: true,
            },
          },
          divisionStandings: {
            select: {
              rank: true,
              wins: true,
              losses: true,
              matchesPlayed: true,
              divisionId: true,
            },
            take: 1,
          },
          successors: {
            where: {
              status: { in: ["INCOMPLETE", "ACTIVE"] },
            },
            include: {
              captain: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
              partner: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Transform to add standing data with totalInDivision
  const requestsWithStandings = await Promise.all(
    requests.map(async (request) => {
      let standing = null;
      if (request.partnership?.divisionStandings?.[0]) {
        const divisionStanding = request.partnership.divisionStandings[0];
        // Count total standings in the same division
        const totalInDivision = divisionStanding.divisionId
          ? await prisma.divisionStanding.count({
              where: { divisionId: divisionStanding.divisionId },
            })
          : 0;
        standing = {
          rank: divisionStanding.rank,
          wins: divisionStanding.wins,
          losses: divisionStanding.losses,
          matchesPlayed: divisionStanding.matchesPlayed,
          totalInDivision,
        };
      }
      return {
        ...request,
        partnership: request.partnership
          ? {
              ...request.partnership,
              standing,
              divisionStandings: undefined, // Remove raw data
            }
          : null,
      };
    })
  );

  return requestsWithStandings as WithdrawalRequestAdmin[];
}

/**
 * Get withdrawal request statistics
 */
export async function getWithdrawalRequestStats(): Promise<WithdrawalRequestStats> {
  const [pending, approved, rejected, totalDissolved] = await Promise.all([
    prisma.withdrawalRequest.count({
      where: { status: "PENDING" },
    }),
    prisma.withdrawalRequest.count({
      where: { status: "APPROVED" },
    }),
    prisma.withdrawalRequest.count({
      where: { status: "REJECTED" },
    }),
    prisma.partnership.count({
      where: { status: "DISSOLVED" },
    }),
  ]);

  return {
    pending,
    approved,
    rejected,
    total: pending + approved + rejected,
    totalDissolved,
  };
}

/**
 * Get all dissolved partnerships with lifecycle information
 */
export async function getDissolvedPartnerships(filters?: {
  seasonId?: string;
  search?: string;
  status?: "DISSOLVED" | "EXPIRED";
}): Promise<DissolvedPartnershipLifecycle[]> {
  const whereClause: any = {};

  // Filter by specific status or default to both DISSOLVED and EXPIRED
  if (filters?.status) {
    whereClause.status = filters.status;
  } else {
    whereClause.status = { in: ["DISSOLVED", "EXPIRED"] };
  }

  if (filters?.seasonId) {
    whereClause.seasonId = filters.seasonId;
  }

  // Search by captain or partner name
  if (filters?.search) {
    whereClause.OR = [
      {
        captain: {
          name: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      },
      {
        partner: {
          name: {
            contains: filters.search,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  const partnerships = await prisma.partnership.findMany({
    where: whereClause,
    include: {
      captain: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
        },
      },
      partner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
        },
      },
      season: {
        select: {
          id: true,
          name: true,
        },
      },
      division: {
        select: {
          id: true,
          name: true,
        },
      },
      divisionStandings: {
        select: {
          rank: true,
          wins: true,
          losses: true,
          matchesPlayed: true,
          divisionId: true,
        },
        take: 1,
      },
      withdrawalRequest: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      successors: {
        where: {
          status: { in: ["INCOMPLETE", "ACTIVE"] },
        },
        include: {
          captain: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          partner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          divisionStandings: {
            select: {
              rank: true,
              wins: true,
              losses: true,
              matchesPlayed: true,
              divisionId: true,
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      dissolvedAt: "desc",
    },
  });

  // Transform to add standing data with totalInDivision
  const partnershipsWithStandings = await Promise.all(
    partnerships.map(async (p) => {
      // Get standing - first check successor (standings may have been transferred)
      let standing = null;
      const successorWithStanding = p.successors.find(
        (s) => s.divisionStandings && s.divisionStandings.length > 0
      );
      const divisionStanding =
        successorWithStanding?.divisionStandings?.[0] ||
        p.divisionStandings?.[0];

      if (divisionStanding) {
        const totalInDivision = divisionStanding.divisionId
          ? await prisma.divisionStanding.count({
              where: { divisionId: divisionStanding.divisionId },
            })
          : 0;
        standing = {
          rank: divisionStanding.rank,
          wins: divisionStanding.wins,
          losses: divisionStanding.losses,
          matchesPlayed: divisionStanding.matchesPlayed,
          totalInDivision,
        };
      }

      return {
        ...p,
        standing,
        divisionStandings: undefined, // Remove raw data
        successors: p.successors.map((s) => ({
          ...s,
          divisionStandings: undefined, // Remove raw data from successors
        })),
        withdrawalRequest: p.withdrawalRequest[0] || null,
      };
    })
  );

  return partnershipsWithStandings as DissolvedPartnershipLifecycle[];
}

/**
 * Get a single dissolved partnership by ID with full lifecycle
 */
export async function getDissolvedPartnershipById(
  id: string
): Promise<DissolvedPartnershipLifecycle | null> {
  const partnership = await prisma.partnership.findUnique({
    where: { id },
    include: {
      captain: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
        },
      },
      partner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
        },
      },
      season: {
        select: {
          id: true,
          name: true,
        },
      },
      division: {
        select: {
          id: true,
          name: true,
        },
      },
      divisionStandings: {
        select: {
          rank: true,
          wins: true,
          losses: true,
          matchesPlayed: true,
          divisionId: true,
        },
        take: 1,
      },
      withdrawalRequest: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      successors: {
        where: {
          status: { in: ["INCOMPLETE", "ACTIVE"] },
        },
        include: {
          captain: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          partner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          divisionStandings: {
            select: {
              rank: true,
              wins: true,
              losses: true,
              matchesPlayed: true,
              divisionId: true,
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!partnership) {
    return null;
  }

  // Get standing - first check successor (standings may have been transferred)
  let standing = null;
  const successorWithStanding = partnership.successors.find(
    (s) => s.divisionStandings && s.divisionStandings.length > 0
  );
  const divisionStanding =
    successorWithStanding?.divisionStandings?.[0] ||
    partnership.divisionStandings?.[0];

  if (divisionStanding) {
    const totalInDivision = divisionStanding.divisionId
      ? await prisma.divisionStanding.count({
          where: { divisionId: divisionStanding.divisionId },
        })
      : 0;
    standing = {
      rank: divisionStanding.rank,
      wins: divisionStanding.wins,
      losses: divisionStanding.losses,
      matchesPlayed: divisionStanding.matchesPlayed,
      totalInDivision,
    };
  }

  return {
    ...partnership,
    standing,
    divisionStandings: undefined,
    successors: partnership.successors.map((s) => ({
      ...s,
      divisionStandings: undefined,
    })),
    withdrawalRequest: partnership.withdrawalRequest[0] || null,
  } as DissolvedPartnershipLifecycle;
}
