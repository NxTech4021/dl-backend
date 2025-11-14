import { PaymentStatus } from "@prisma/client";

export interface CreateSeasonData {
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  regiDeadline?: string | Date;
  description?: string;
  entryFee: string | number;
  leagueIds: string[];
  categoryId: string;
  sponsorId?: string;
  isActive?: boolean;
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}

export interface UpdateSeasonData {
  name?: string;
  startDate?: string;
  endDate?: string;
  regiDeadline?: string;
  entryFee?: number;
  description?: string;
  leagueIds?: string[];
  categoryId?: string;
  sponsorId?: string;
  isActive?: boolean;
  status?: "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  paymentRequired?: boolean;
  promoCodeSupported?: boolean;
  withdrawalEnabled?: boolean;
}

export interface StatusUpdateData {
  status?: "UPCOMING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  isActive?: boolean;
}

export interface RegisterSeasonMembershipData {
  userId: string;
  seasonId: string;
  divisionId?: string;
  payLater?: boolean;
}

export interface UpdatePaymentStatusData {
  membershipId: string;
  paymentStatus: PaymentStatus;
}

export interface AssignDivisionData {
  membershipId: string;
  divisionId: string;
}

export interface SubmitWithdrawalRequestData {
  userId: string;
  seasonId: string;
  reason: string;
  partnershipId?: string;
}