export const validateCreateSeasonData = (data: any) => {
  const { name, startDate, endDate, entryFee, leagueIds, categoryId } = data;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { 
      isValid: false, 
      error: "Season name is required and must be a non-empty string" 
    };
  }

  if (!startDate || !endDate) {
    return { 
      isValid: false, 
      error: "Start date and end date are required" 
    };
  }

  if (new Date(startDate) >= new Date(endDate)) {
    return {
      isValid: false,
      error: "Start date must be before end date"
    };
  }

  if (!entryFee || isNaN(Number(entryFee)) || Number(entryFee) < 0) {
    return { 
      isValid: false, 
      error: "Entry fee must be a valid non-negative number" 
    };
  }

  if (!leagueIds || !Array.isArray(leagueIds) || leagueIds.length === 0) {
    return { 
      isValid: false, 
      error: "At least one league must be specified" 
    };
  }

  if (!categoryId || typeof categoryId !== 'string') {
    return { 
      isValid: false, 
      error: "A category must be specified" 
    };
  }

  return { isValid: true };
};

export const validateUpdateSeasonData = (data: any) => {
  const { leagueIds, categoryIds, startDate, endDate, entryFee, name } = data;

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return {
      isValid: false,
      error: "Season name must be a non-empty string"
    };
  }

  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    return {
      isValid: false,
      error: "Start date must be before end date"
    };
  }

  if (entryFee !== undefined && (isNaN(Number(entryFee)) || Number(entryFee) < 0)) {
    return {
      isValid: false,
      error: "Entry fee must be a valid non-negative number"
    };
  }

  if (leagueIds && (!Array.isArray(leagueIds) || leagueIds.length === 0)) {
    return {
      isValid: false,
      error: "leagueIds must be an array with at least one league"
    };
  }

  if (categoryIds && (!Array.isArray(categoryIds) || categoryIds.length === 0)) {
    return {
      isValid: false,
      error: "categoryIds must be an array with at least one category"
    };
  }

  return { isValid: true };
};

export const validateStatusUpdate = (data: any) => {
  const { status, isActive } = data;

  if (!status && typeof isActive === "undefined") {
    return {
      isValid: false,
      error: "Provide either status or isActive."
    };
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return {
      isValid: false,
      error: "isActive must be a boolean value"
    };
  }

  return { isValid: true };
};

export const validateWithdrawalRequest = (data: any) => {
  const { seasonId, reason } = data;

  if (!seasonId || typeof seasonId !== 'string') {
    return {
      isValid: false,
      error: "seasonId is required and must be a string"
    };
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return {
      isValid: false,
      error: "reason is required and must be a non-empty string"
    };
  }

  if (reason.length > 500) {
    return {
      isValid: false,
      error: "Reason must be less than 500 characters"
    };
  }

  return { isValid: true };
};