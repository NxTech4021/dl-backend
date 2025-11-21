interface UserRating {
  questionnaireResponses?: Array<{
    result?: {
      singles?: number | null;
      doubles?: number | null;
    } | null;
  }>;
}

export const getUserRating = (user: UserRating) => {

  const questionnaireRating = user.questionnaireResponses?.[0]?.result;
  if (questionnaireRating && (questionnaireRating.singles || questionnaireRating.doubles)) {
    return {
      singlesRating: questionnaireRating.singles || null,
      doublesRating: questionnaireRating.doubles || null
    };
  }

  return {
    singlesRating: null,
    doublesRating: null
  };
};

export const formatUser = (user: any) => {
  if (!user) return null;
  
  const ratings = getUserRating(user);
  
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    username: user.username,
    ...ratings
  };
};

export const formatLeagues = (leagues: any[]) => {
  return leagues?.map(league => ({
    id: league.id,
    name: league.name,
    sportType: league.sportType,
    gameType: league.gameType
  })) ?? [];
};

export const formatCategories = (categories: any[]) => {
  return categories?.map(category => ({
    id: category.id,
    name: category.name,
    genderRestriction: category.genderRestriction,
    matchFormat: category.matchFormat
  })) ?? [];
};

export const formatCategory = (category: any) => {
  if (!category) return null;
  return {
    id: category.id,
    name: category.name,
    genderRestriction: category.genderRestriction,
    matchFormat: category.matchFormat
  };
};

export const formatMemberships = (memberships: any[], registrations: any[]) => {
  const formattedMemberships = memberships?.map(membership => ({
    id: membership.id,
    userId: membership.userId,
    seasonId: membership.seasonId,
    divisionId: membership.divisionId,
    status: membership.status,
    joinedAt: membership.joinedAt,
    withdrawalReason: membership.withdrawalReason,
    paymentStatus: membership.paymentStatus,
    user: formatUser(membership.user)
  })) || [];

  const formattedRegistrations = registrations?.map(registration => ({
    id: `reg_${registration.id}`,
    userId: registration.playerId,
    seasonId: registration.seasonId.toString(),
    divisionId: registration.divisionId?.toString() || null,
    status: 'ACTIVE',
    joinedAt: registration.registeredAt,
    withdrawalReason: null,
    paymentStatus: 'PENDING',
    user: formatUser(registration.player)
  })) || [];

  return [...formattedMemberships, ...formattedRegistrations];
};

export const formatSeasonResponse = (season: any) => {
  return {
    ...season,
    leagues: formatLeagues(season.leagues),
    category: formatCategory(season.category),
    memberships: formatMemberships(season.memberships, season.registrations)
  };
};