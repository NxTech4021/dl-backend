-- CreateEnum
CREATE TYPE "public"."NotificationCategory" AS ENUM ('DIVISION', 'LEAGUE', 'CHAT', 'MATCH', 'SEASON', 'PAYMENT', 'ADMIN', 'GENERAL');

-- CreateEnum
CREATE TYPE "public"."PairRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DENIED', 'CANCELLED', 'EXPIRED', 'AUTO_DENIED');

-- CreateEnum
CREATE TYPE "public"."PartnershipStatus" AS ENUM ('ACTIVE', 'DISSOLVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "public"."AdminStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."SeasonStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."GenderRestriction" AS ENUM ('MALE', 'FEMALE', 'MIXED', 'OPEN');

-- CreateEnum
CREATE TYPE "public"."GenderType" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- CreateEnum
CREATE TYPE "public"."MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'FLAGGED', 'INACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "public"."Statuses" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'UPCOMING', 'ONGOING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."DivisionLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "public"."GameType" AS ENUM ('SINGLES', 'DOUBLES');

-- CreateEnum
CREATE TYPE "public"."SportType" AS ENUM ('PADEL', 'PICKLEBALL', 'TENNIS');

-- CreateEnum
CREATE TYPE "public"."TierType" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "public"."FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "public"."SeasonInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DENIED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."MatchStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'UNFINISHED', 'CANCELLED', 'VOID');

-- CreateEnum
CREATE TYPE "public"."DisputeCategory" AS ENUM ('WRONG_SCORE', 'NO_SHOW', 'BEHAVIOR', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."DisputePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."DisputeResolutionAction" AS ENUM ('UPHOLD_ORIGINAL', 'UPHOLD_DISPUTER', 'CUSTOM_SCORE', 'VOID_MATCH', 'AWARD_WALKOVER', 'REQUEST_MORE_INFO');

-- CreateEnum
CREATE TYPE "public"."WalkoverReason" AS ENUM ('NO_SHOW', 'LATE_CANCELLATION', 'INJURY', 'PERSONAL_EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PenaltyType" AS ENUM ('WARNING', 'POINTS_DEDUCTION', 'SUSPENSION', 'NONE');

-- CreateEnum
CREATE TYPE "public"."PenaltySeverity" AS ENUM ('WARNING', 'POINTS_DEDUCTION', 'SUSPENSION', 'PERMANENT_BAN');

-- CreateEnum
CREATE TYPE "public"."PenaltyStatus" AS ENUM ('ACTIVE', 'APPEALED', 'OVERTURNED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."MatchAdminActionType" AS ENUM ('EDIT_RESULT', 'VOID_MATCH', 'CONVERT_TO_WALKOVER', 'OVERRIDE_DISPUTE', 'APPLY_PENALTY', 'REMOVE_PARTICIPANT', 'ADD_PARTICIPANT', 'APPROVE_LATE_CANCELLATION', 'DENY_LATE_CANCELLATION', 'EDIT_SCHEDULE');

-- CreateEnum
CREATE TYPE "public"."RatingChangeReason" AS ENUM ('MATCH_WIN', 'MATCH_LOSS', 'WALKOVER_WIN', 'WALKOVER_LOSS', 'MANUAL_ADJUSTMENT', 'RECALCULATION', 'INITIAL_PLACEMENT', 'SEASON_RESET');

-- CreateEnum
CREATE TYPE "public"."AdjustmentType" AS ENUM ('MIGRATION', 'CORRECTION', 'APPEAL_RESOLUTION', 'ADMIN_OVERRIDE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RecalculationScope" AS ENUM ('MATCH', 'PLAYER', 'DIVISION', 'SEASON', 'LEAGUE');

-- CreateEnum
CREATE TYPE "public"."RecalculationStatus" AS ENUM ('PENDING', 'GENERATING_PREVIEW', 'PREVIEW_READY', 'APPLYING', 'APPLIED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."StatusChangeReason" AS ENUM ('INACTIVITY_THRESHOLD', 'INACTIVITY_WARNING', 'MATCH_PLAYED', 'ADMIN_MANUAL', 'SEASON_START', 'SEASON_END', 'REGISTRATION', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "public"."BugReportType" AS ENUM ('BUG', 'FEEDBACK', 'SUGGESTION', 'QUESTION', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "public"."BugSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "public"."BugPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "public"."BugStatus" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'NEEDS_INFO', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'WONT_FIX', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "public"."MatchFormat" AS ENUM ('STANDARD', 'ONE_SET');

-- CreateEnum
CREATE TYPE "public"."MatchType" AS ENUM ('SINGLES', 'DOUBLES');

-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ParticipantRole" AS ENUM ('CREATOR', 'OPPONENT', 'PARTNER', 'INVITED');

-- CreateEnum
CREATE TYPE "public"."CancellationReason" AS ENUM ('PERSONAL_EMERGENCY', 'INJURY', 'WEATHER', 'SCHEDULING_CONFLICT', 'ILLNESS', 'WORK_COMMITMENT', 'FAMILY_EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."TimeSlotStatus" AS ENUM ('PROPOSED', 'VOTED', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'MATCH', 'SYSTEM', 'JOIN_REQUEST');

-- CreateEnum
CREATE TYPE "public"."BracketType" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "public"."BracketStatus" AS ENUM ('DRAFT', 'SEEDED', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."SeedingSource" AS ENUM ('STANDINGS', 'MANUAL', 'RATING');

-- CreateEnum
CREATE TYPE "public"."BracketMatchStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'BYE');

-- CreateEnum
CREATE TYPE "public"."TiebreakType" AS ENUM ('STANDARD_7PT', 'MATCH_10PT');

-- CreateEnum
CREATE TYPE "public"."Set3Format" AS ENUM ('MATCH_TIEBREAK', 'FULL_SET');

-- CreateTable
CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayUsername" TEXT,
    "username" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "area" TEXT,
    "completedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityCheck" TIMESTAMP(3),
    "lastLogin" TIMESTAMP(3),
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "bio" TEXT,
    "phoneNumber" TEXT,
    "lastMatchDate" TIMESTAMP(3),
    "inactivityWarningAt" TIMESTAMP(3),
    "markedInactiveAt" TIMESTAMP(3),
    "inactivityExempt" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" "public"."AdminStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminInviteToken" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminInviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestionnaireResponse" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "qVersion" INTEGER NOT NULL,
    "qHash" TEXT NOT NULL,
    "answersJson" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InitialRatingResult" (
    "id" SERIAL NOT NULL,
    "responseId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "singles" INTEGER,
    "doubles" INTEGER,
    "rd" INTEGER,
    "confidence" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitialRatingResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."League" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "status" "public"."Statuses" NOT NULL DEFAULT 'UPCOMING',
    "sportType" "public"."SportType" NOT NULL,
    "gameType" "public"."GameType" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255),
    "genderRestriction" "public"."GenderRestriction" NOT NULL DEFAULT 'OPEN',
    "matchFormat" TEXT,
    "gameType" "public"."GameType",
    "genderCategory" "public"."GenderType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sponsorship" (
    "id" TEXT NOT NULL,
    "packageTier" "public"."TierType" NOT NULL,
    "contractAmount" DECIMAL(10,2),
    "sponsorRevenue" DECIMAL(10,2),
    "sponsoredName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "regiDeadline" TIMESTAMP(3),
    "entryFee" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "registeredUserCount" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."SeasonStatus" NOT NULL DEFAULT 'UPCOMING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
    "promoCodeSupported" BOOLEAN NOT NULL DEFAULT false,
    "withdrawalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "sponsorId" TEXT,
    "waitlistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Waitlist" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxParticipants" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WaitlistUser" (
    "id" TEXT NOT NULL,
    "waitlistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "waitlistDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedToRegistered" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WaitlistUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "isPercentage" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "processedByAdminId" TEXT,
    "partnershipId" TEXT,
    "seasonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."division" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" "public"."DivisionLevel",
    "gameType" "public"."GameType" NOT NULL,
    "genderCategory" "public"."GenderType",
    "maxSinglesPlayers" INTEGER,
    "maxDoublesTeams" INTEGER,
    "currentSinglesCount" INTEGER DEFAULT 0,
    "currentDoublesCount" INTEGER DEFAULT 0,
    "autoAssignmentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActiveDivision" BOOLEAN NOT NULL DEFAULT true,
    "pointsThreshold" INTEGER,
    "divisionSponsorId" TEXT,
    "sponsoredDivisionName" TEXT,
    "prizePoolTotal" DECIMAL(10,2),
    "createdByAdminId" TEXT,
    "lastUpdatedByAdminId" TEXT,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeasonMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "divisionId" TEXT,
    "status" "public"."MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawalReason" TEXT,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "SeasonMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."division_assignment" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reassignmentCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "division_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Match" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT,
    "leagueId" TEXT,
    "seasonId" TEXT,
    "sport" TEXT NOT NULL,
    "matchType" "public"."MatchType" NOT NULL DEFAULT 'SINGLES',
    "playerScore" INTEGER,
    "opponentScore" INTEGER,
    "outcome" TEXT,
    "matchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "venue" TEXT,
    "notes" TEXT,
    "duration" INTEGER,
    "courtBooked" BOOLEAN,
    "format" "public"."MatchFormat" NOT NULL DEFAULT 'STANDARD',
    "isOneSet" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "status" "public"."MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isWalkover" BOOLEAN NOT NULL DEFAULT false,
    "isDisputed" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "proposedTimes" JSONB,
    "scheduledTime" TIMESTAMP(3),
    "scheduledStartTime" TIMESTAMP(3),
    "actualStartTime" TIMESTAMP(3),
    "team1Score" INTEGER,
    "team2Score" INTEGER,
    "setScores" JSONB,
    "resultSubmittedById" TEXT,
    "resultSubmittedAt" TIMESTAMP(3),
    "resultConfirmedById" TEXT,
    "resultConfirmedAt" TIMESTAMP(3),
    "resultComment" TEXT,
    "resultEvidence" TEXT,
    "isAutoApproved" BOOLEAN NOT NULL DEFAULT false,
    "cancellationRequestedAt" TIMESTAMP(3),
    "isLateCancellation" BOOLEAN NOT NULL DEFAULT false,
    "cancellationReason" "public"."CancellationReason",
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationComment" TEXT,
    "walkoverReason" "public"."WalkoverReason",
    "walkoverRecordedById" TEXT,
    "rescheduledFromId" TEXT,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "walkoverScore" JSONB,
    "requiresAdminReview" BOOLEAN NOT NULL DEFAULT false,
    "set3Format" "public"."Set3Format",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatchParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isStarter" BOOLEAN NOT NULL DEFAULT true,
    "team" TEXT,
    "role" "public"."ParticipantRole" NOT NULL DEFAULT 'INVITED',
    "invitationStatus" "public"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "didAttend" BOOLEAN,
    "arrivedAt" TIMESTAMP(3),
    "wasLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MatchStats" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerAces" INTEGER,
    "playerUnforcedErrors" INTEGER,
    "playerWinners" INTEGER,
    "playerDoubleFaults" INTEGER,
    "opponentAces" INTEGER,
    "opponentUnforcedErrors" INTEGER,
    "opponentWinners" INTEGER,
    "opponentDoubleFaults" INTEGER,
    "rallyCount" INTEGER,
    "longestRally" INTEGER,
    "breakPointsConverted" INTEGER,
    "breakPointsTotal" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_invitation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "declineReason" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "match_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_time_slot" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "proposedTime" TIMESTAMP(3) NOT NULL,
    "status" "public"."TimeSlotStatus" NOT NULL DEFAULT 'PROPOSED',
    "location" TEXT,
    "notes" TEXT,
    "votes" JSONB,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_time_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_join_request" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "public"."JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    "declineReason" TEXT,

    CONSTRAINT "match_join_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bracket" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "bracketName" TEXT NOT NULL,
    "bracketType" "public"."BracketType" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "status" "public"."BracketStatus" NOT NULL DEFAULT 'DRAFT',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "seedingSource" "public"."SeedingSource" NOT NULL DEFAULT 'STANDINGS',
    "numPlayers" INTEGER NOT NULL DEFAULT 8,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bracket_round" (
    "id" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "roundName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bracket_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bracket_match" (
    "id" TEXT NOT NULL,
    "bracketId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "seed1" INTEGER,
    "seed2" INTEGER,
    "player1Id" TEXT,
    "player2Id" TEXT,
    "team1Id" TEXT,
    "team2Id" TEXT,
    "matchId" TEXT,
    "winnerId" TEXT,
    "nextMatchId" TEXT,
    "loserNextMatchId" TEXT,
    "status" "public"."BracketMatchStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledTime" TIMESTAMP(3),
    "courtLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bracket_match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_dispute" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "raisedByUserId" TEXT NOT NULL,
    "disputeCategory" "public"."DisputeCategory" NOT NULL,
    "disputeComment" TEXT NOT NULL,
    "disputerScore" JSONB,
    "evidenceUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminResolution" TEXT,
    "resolutionAction" "public"."DisputeResolutionAction",
    "finalScore" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "status" "public"."DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "public"."DisputePriority" NOT NULL DEFAULT 'NORMAL',
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByAdminId" TEXT,
    "resolvedByAdminId" TEXT,

    CONSTRAINT "match_dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispute_admin_note" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_admin_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dispute_comment" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_walkover" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "walkoverFlag" BOOLEAN NOT NULL DEFAULT true,
    "walkoverReason" "public"."WalkoverReason" NOT NULL,
    "walkoverReasonDetail" TEXT,
    "defaultingPlayerId" TEXT NOT NULL,
    "winningPlayerId" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "confirmedBy" TEXT,
    "adminVerified" BOOLEAN NOT NULL DEFAULT false,
    "adminVerifiedBy" TEXT,
    "adminVerifiedAt" TIMESTAMP(3),
    "penaltyApplied" BOOLEAN NOT NULL DEFAULT false,
    "penaltyType" "public"."PenaltyType",
    "penaltyDetails" TEXT,
    "penaltyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_walkover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."player_penalty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "penaltyType" "public"."PenaltyType" NOT NULL,
    "severity" "public"."PenaltySeverity" NOT NULL,
    "relatedMatchId" TEXT,
    "relatedDisputeId" TEXT,
    "pointsDeducted" INTEGER,
    "suspensionDays" INTEGER,
    "suspensionStartDate" TIMESTAMP(3),
    "suspensionEndDate" TIMESTAMP(3),
    "issuedByAdminId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "public"."PenaltyStatus" NOT NULL DEFAULT 'ACTIVE',
    "appealSubmittedAt" TIMESTAMP(3),
    "appealReason" TEXT,
    "appealResolvedBy" TEXT,
    "appealResolvedAt" TIMESTAMP(3),
    "appealResolutionNotes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_penalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_admin_action" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "actionType" "public"."MatchAdminActionType" NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT NOT NULL,
    "affectedUserIds" JSONB,
    "triggeredRecalculation" BOOLEAN NOT NULL DEFAULT false,
    "recalculationDetails" JSONB,
    "notifiedUsers" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_admin_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."player_rating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "divisionId" TEXT,
    "sport" "public"."SportType" NOT NULL,
    "gameType" "public"."GameType" NOT NULL,
    "currentRating" INTEGER NOT NULL,
    "ratingDeviation" INTEGER,
    "volatility" DOUBLE PRECISION,
    "isProvisional" BOOLEAN NOT NULL DEFAULT true,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "lastMatchId" TEXT,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "peakRating" INTEGER,
    "peakRatingDate" TIMESTAMP(3),
    "lowestRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rating_history" (
    "id" TEXT NOT NULL,
    "playerRatingId" TEXT NOT NULL,
    "matchId" TEXT,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "rdBefore" INTEGER,
    "rdAfter" INTEGER,
    "reason" "public"."RatingChangeReason" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_score" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "player1Games" INTEGER NOT NULL,
    "player2Games" INTEGER NOT NULL,
    "hasTiebreak" BOOLEAN NOT NULL DEFAULT false,
    "player1Tiebreak" INTEGER,
    "player2Tiebreak" INTEGER,
    "tiebreakType" "public"."TiebreakType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."match_result" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "sportType" "public"."SportType" NOT NULL,
    "gameType" "public"."GameType" NOT NULL,
    "isWin" BOOLEAN NOT NULL,
    "matchPoints" INTEGER NOT NULL,
    "participationPoints" INTEGER NOT NULL DEFAULT 1,
    "setsWonPoints" INTEGER NOT NULL,
    "winBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "margin" INTEGER NOT NULL,
    "setsWon" INTEGER NOT NULL,
    "setsLost" INTEGER NOT NULL,
    "gamesWon" INTEGER NOT NULL,
    "gamesLost" INTEGER NOT NULL,
    "datePlayed" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countsForStandings" BOOLEAN NOT NULL DEFAULT false,
    "resultSequence" INTEGER,

    CONSTRAINT "match_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pickleball_game_score" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "player1Points" INTEGER NOT NULL,
    "player2Points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickleball_game_score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."division_standing" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT,
    "partnershipId" TEXT,
    "rank" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "matchesScheduled" INTEGER NOT NULL DEFAULT 9,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "countedWins" INTEGER NOT NULL DEFAULT 0,
    "countedLosses" INTEGER NOT NULL DEFAULT 0,
    "setsWon" INTEGER NOT NULL DEFAULT 0,
    "setsLost" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "gamesLost" INTEGER NOT NULL DEFAULT 0,
    "best6SetsWon" INTEGER NOT NULL DEFAULT 0,
    "best6SetsTotal" INTEGER NOT NULL DEFAULT 0,
    "best6GamesWon" INTEGER NOT NULL DEFAULT 0,
    "best6GamesTotal" INTEGER NOT NULL DEFAULT 0,
    "headToHead" JSONB,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "winPoints" INTEGER NOT NULL DEFAULT 0,
    "setPoints" INTEGER NOT NULL DEFAULT 0,
    "completionBonus" INTEGER NOT NULL DEFAULT 0,
    "setDifferential" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "division_standing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rating_adjustment" (
    "id" TEXT NOT NULL,
    "playerRatingId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adjustmentType" "public"."AdjustmentType" NOT NULL,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "internalNotes" TEXT,
    "playerNotified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "rating_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rating_parameters" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT,
    "seasonId" TEXT,
    "initialRating" INTEGER NOT NULL DEFAULT 1500,
    "initialRD" INTEGER NOT NULL DEFAULT 350,
    "kFactorNew" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "kFactorEstablished" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "kFactorThreshold" INTEGER NOT NULL DEFAULT 30,
    "singlesWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "doublesWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "oneSetMatchWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "walkoverWinImpact" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "walkoverLossImpact" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "provisionalThreshold" INTEGER NOT NULL DEFAULT 10,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "rating_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rating_recalculation" (
    "id" TEXT NOT NULL,
    "scope" "public"."RecalculationScope" NOT NULL,
    "matchId" TEXT,
    "userId" TEXT,
    "divisionId" TEXT,
    "seasonId" TEXT,
    "leagueId" TEXT,
    "status" "public"."RecalculationStatus" NOT NULL DEFAULT 'PENDING',
    "initiatedByAdminId" TEXT NOT NULL,
    "affectedPlayersCount" INTEGER,
    "changesPreview" JSONB,
    "previewGeneratedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_recalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."season_lock" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedByAdminId" TEXT NOT NULL,
    "finalExportUrl" TEXT,
    "exportGeneratedAt" TIMESTAMP(3),
    "overrideAllowed" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideByAdminId" TEXT,
    "overrideAt" TIMESTAMP(3),

    CONSTRAINT "season_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inactivity_settings" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT,
    "seasonId" TEXT,
    "inactivityThresholdDays" INTEGER NOT NULL DEFAULT 14,
    "warningThresholdDays" INTEGER,
    "autoMarkInactive" BOOLEAN NOT NULL DEFAULT true,
    "excludeFromPairing" BOOLEAN NOT NULL DEFAULT true,
    "sendReminderEmail" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBefore" INTEGER DEFAULT 3,
    "updatedByAdminId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inactivity_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."player_status_change" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousStatus" "public"."UserStatus" NOT NULL,
    "newStatus" "public"."UserStatus" NOT NULL,
    "reason" "public"."StatusChangeReason" NOT NULL,
    "notes" TEXT,
    "triggeredById" TEXT,
    "matchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_status_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."app" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "appUrl" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bug_module" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bug_report" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "reportType" "public"."BugReportType" NOT NULL DEFAULT 'BUG',
    "severity" "public"."BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "stepsToReproduce" TEXT,
    "expectedBehavior" TEXT,
    "actualBehavior" TEXT,
    "priority" "public"."BugPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "public"."BugStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "appId" TEXT NOT NULL,
    "pageUrl" TEXT,
    "userAgent" TEXT,
    "browserName" TEXT,
    "browserVersion" TEXT,
    "osName" TEXT,
    "osVersion" TEXT,
    "screenWidth" INTEGER,
    "screenHeight" INTEGER,
    "appVersion" TEXT,
    "sessionId" TEXT,
    "consoleErrors" JSONB,
    "networkRequests" JSONB,
    "localStorageData" JSONB,
    "reporterId" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "rootCause" TEXT,
    "timeToResolve" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateOfId" TEXT,
    "externalTicketUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sheetSyncedAt" TIMESTAMP(3),
    "sheetRowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bug_screenshot" (
    "id" TEXT NOT NULL,
    "bugReportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bug_comment" (
    "id" TEXT NOT NULL,
    "bugReportId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bug_status_change" (
    "id" TEXT NOT NULL,
    "bugReportId" TEXT NOT NULL,
    "previousStatus" "public"."BugStatus",
    "newStatus" "public"."BugStatus" NOT NULL,
    "previousPriority" "public"."BugPriority",
    "newPriority" "public"."BugPriority",
    "changedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_status_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bug_report_settings" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "enableScreenshots" BOOLEAN NOT NULL DEFAULT true,
    "enableAutoCapture" BOOLEAN NOT NULL DEFAULT true,
    "enableConsoleCapture" BOOLEAN NOT NULL DEFAULT true,
    "enableNetworkCapture" BOOLEAN NOT NULL DEFAULT false,
    "maxScreenshots" INTEGER NOT NULL DEFAULT 5,
    "maxFileSize" INTEGER NOT NULL DEFAULT 5242880,
    "notifyEmails" JSONB,
    "slackWebhookUrl" TEXT,
    "discordWebhookUrl" TEXT,
    "notifyOnNew" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnStatusChange" BOOLEAN NOT NULL DEFAULT true,
    "googleSheetId" TEXT,
    "googleSheetName" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultAssigneeId" TEXT,
    "defaultPriority" "public"."BugPriority" NOT NULL DEFAULT 'NORMAL',
    "customFields" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_report_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Achievement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT NOT NULL,
    "requirement" JSONB,
    "points" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" JSONB,
    "isCompleted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Thread" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "divisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserThread" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "messageType" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "matchId" TEXT,
    "matchData" JSONB,
    "repliesToId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "public"."FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoritedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pair_request" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "message" TEXT,
    "status" "public"."PairRequestStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pair_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."partnership" (
    "id" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "divisionId" TEXT,
    "pairRating" INTEGER,
    "status" "public"."PartnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dissolvedAt" TIMESTAMP(3),

    CONSTRAINT "partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."season_invitation" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "message" TEXT,
    "status" "public"."SeasonInvitationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "category" "public"."NotificationCategory" NOT NULL,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seasonId" TEXT,
    "divisionId" TEXT,
    "matchId" TEXT,
    "userId" TEXT,
    "partnershipId" TEXT,
    "threadId" TEXT,
    "pairRequestId" TEXT,
    "withdrawalRequestId" TEXT,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "archive" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "user_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchReminders" BOOLEAN NOT NULL DEFAULT true,
    "matchRescheduled" BOOLEAN NOT NULL DEFAULT true,
    "matchCancelled" BOOLEAN NOT NULL DEFAULT true,
    "matchResults" BOOLEAN NOT NULL DEFAULT true,
    "partnerChange" BOOLEAN NOT NULL DEFAULT true,
    "opponentChange" BOOLEAN NOT NULL DEFAULT true,
    "ratingChange" BOOLEAN NOT NULL DEFAULT true,
    "inactivityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "chatNotifications" BOOLEAN NOT NULL DEFAULT true,
    "invitations" BOOLEAN NOT NULL DEFAULT true,
    "seasonRegistration" BOOLEAN NOT NULL DEFAULT true,
    "seasonUpdates" BOOLEAN NOT NULL DEFAULT true,
    "disputeAlerts" BOOLEAN NOT NULL DEFAULT true,
    "teamChangeRequests" BOOLEAN NOT NULL DEFAULT true,
    "withdrawalRequests" BOOLEAN NOT NULL DEFAULT true,
    "playerReports" BOOLEAN NOT NULL DEFAULT true,
    "seasonJoinRequests" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_LeagueToSeason" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LeagueToSeason_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_LeagueToSponsorship" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LeagueToSponsorship_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_SeasonPromoCodes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SeasonPromoCodes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "public"."user"("username");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "public"."user"("email");

-- CreateIndex
CREATE INDEX "user_lastMatchDate_idx" ON "public"."user"("lastMatchDate");

-- CreateIndex
CREATE INDEX "user_username_idx" ON "public"."user"("username");

-- CreateIndex
CREATE INDEX "user_status_idx" ON "public"."user"("status");

-- CreateIndex
CREATE INDEX "user_completedOnboarding_idx" ON "public"."user"("completedOnboarding");

-- CreateIndex
CREATE INDEX "user_createdAt_idx" ON "public"."user"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_userId_key" ON "public"."Admin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInviteToken_adminId_key" ON "public"."AdminInviteToken"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInviteToken_token_key" ON "public"."AdminInviteToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "public"."account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "public"."session"("userId");

-- CreateIndex
CREATE INDEX "session_token_idx" ON "public"."session"("token");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "public"."session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_value_key" ON "public"."verification"("value");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_userId_idx" ON "public"."QuestionnaireResponse"("userId");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_sport_qVersion_idx" ON "public"."QuestionnaireResponse"("sport", "qVersion");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_qHash_idx" ON "public"."QuestionnaireResponse"("qHash");

-- CreateIndex
CREATE UNIQUE INDEX "InitialRatingResult_responseId_key" ON "public"."InitialRatingResult"("responseId");

-- CreateIndex
CREATE INDEX "League_location_idx" ON "public"."League"("location");

-- CreateIndex
CREATE INDEX "League_status_idx" ON "public"."League"("status");

-- CreateIndex
CREATE INDEX "Category_isActive_idx" ON "public"."Category"("isActive");

-- CreateIndex
CREATE INDEX "Season_status_idx" ON "public"."Season"("status");

-- CreateIndex
CREATE INDEX "Season_isActive_idx" ON "public"."Season"("isActive");

-- CreateIndex
CREATE INDEX "Season_sponsorId_idx" ON "public"."Season"("sponsorId");

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_seasonId_key" ON "public"."Waitlist"("seasonId");

-- CreateIndex
CREATE INDEX "WaitlistUser_waitlistId_idx" ON "public"."WaitlistUser"("waitlistId");

-- CreateIndex
CREATE INDEX "WaitlistUser_userId_idx" ON "public"."WaitlistUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistUser_waitlistId_userId_key" ON "public"."WaitlistUser"("waitlistId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "public"."PromoCode"("code");

-- CreateIndex
CREATE INDEX "division_seasonId_idx" ON "public"."division"("seasonId");

-- CreateIndex
CREATE INDEX "division_leagueId_idx" ON "public"."division"("leagueId");

-- CreateIndex
CREATE INDEX "division_isActiveDivision_idx" ON "public"."division"("isActiveDivision");

-- CreateIndex
CREATE INDEX "division_divisionSponsorId_idx" ON "public"."division"("divisionSponsorId");

-- CreateIndex
CREATE UNIQUE INDEX "division_seasonId_name_key" ON "public"."division"("seasonId", "name");

-- CreateIndex
CREATE INDEX "SeasonMembership_userId_idx" ON "public"."SeasonMembership"("userId");

-- CreateIndex
CREATE INDEX "SeasonMembership_seasonId_idx" ON "public"."SeasonMembership"("seasonId");

-- CreateIndex
CREATE INDEX "SeasonMembership_divisionId_status_idx" ON "public"."SeasonMembership"("divisionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMembership_userId_seasonId_divisionId_key" ON "public"."SeasonMembership"("userId", "seasonId", "divisionId");

-- CreateIndex
CREATE INDEX "division_assignment_divisionId_idx" ON "public"."division_assignment"("divisionId");

-- CreateIndex
CREATE INDEX "division_assignment_userId_idx" ON "public"."division_assignment"("userId");

-- CreateIndex
CREATE INDEX "division_assignment_assignedBy_idx" ON "public"."division_assignment"("assignedBy");

-- CreateIndex
CREATE UNIQUE INDEX "division_assignment_divisionId_userId_key" ON "public"."division_assignment"("divisionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_rescheduledFromId_key" ON "public"."Match"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "Match_divisionId_idx" ON "public"."Match"("divisionId");

-- CreateIndex
CREATE INDEX "Match_leagueId_idx" ON "public"."Match"("leagueId");

-- CreateIndex
CREATE INDEX "Match_seasonId_idx" ON "public"."Match"("seasonId");

-- CreateIndex
CREATE INDEX "Match_sport_idx" ON "public"."Match"("sport");

-- CreateIndex
CREATE INDEX "Match_matchDate_idx" ON "public"."Match"("matchDate");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "public"."Match"("status");

-- CreateIndex
CREATE INDEX "Match_isDisputed_idx" ON "public"."Match"("isDisputed");

-- CreateIndex
CREATE INDEX "Match_matchType_idx" ON "public"."Match"("matchType");

-- CreateIndex
CREATE INDEX "Match_scheduledStartTime_idx" ON "public"."Match"("scheduledStartTime");

-- CreateIndex
CREATE INDEX "Match_isLateCancellation_idx" ON "public"."Match"("isLateCancellation");

-- CreateIndex
CREATE INDEX "Match_createdById_idx" ON "public"."Match"("createdById");

-- CreateIndex
CREATE INDEX "Match_format_idx" ON "public"."Match"("format");

-- CreateIndex
CREATE INDEX "Match_requiresAdminReview_idx" ON "public"."Match"("requiresAdminReview");

-- CreateIndex
CREATE INDEX "MatchParticipant_userId_idx" ON "public"."MatchParticipant"("userId");

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_idx" ON "public"."MatchParticipant"("matchId");

-- CreateIndex
CREATE INDEX "MatchParticipant_role_idx" ON "public"."MatchParticipant"("role");

-- CreateIndex
CREATE INDEX "MatchParticipant_invitationStatus_idx" ON "public"."MatchParticipant"("invitationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipant_matchId_userId_key" ON "public"."MatchParticipant"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchStats_matchId_key" ON "public"."MatchStats"("matchId");

-- CreateIndex
CREATE INDEX "match_invitation_matchId_idx" ON "public"."match_invitation"("matchId");

-- CreateIndex
CREATE INDEX "match_invitation_inviterId_idx" ON "public"."match_invitation"("inviterId");

-- CreateIndex
CREATE INDEX "match_invitation_inviteeId_idx" ON "public"."match_invitation"("inviteeId");

-- CreateIndex
CREATE INDEX "match_invitation_status_idx" ON "public"."match_invitation"("status");

-- CreateIndex
CREATE INDEX "match_invitation_expiresAt_idx" ON "public"."match_invitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_invitation_matchId_inviteeId_key" ON "public"."match_invitation"("matchId", "inviteeId");

-- CreateIndex
CREATE INDEX "match_time_slot_matchId_idx" ON "public"."match_time_slot"("matchId");

-- CreateIndex
CREATE INDEX "match_time_slot_proposedById_idx" ON "public"."match_time_slot"("proposedById");

-- CreateIndex
CREATE INDEX "match_time_slot_status_idx" ON "public"."match_time_slot"("status");

-- CreateIndex
CREATE INDEX "match_time_slot_proposedTime_idx" ON "public"."match_time_slot"("proposedTime");

-- CreateIndex
CREATE INDEX "match_join_request_matchId_idx" ON "public"."match_join_request"("matchId");

-- CreateIndex
CREATE INDEX "match_join_request_requesterId_idx" ON "public"."match_join_request"("requesterId");

-- CreateIndex
CREATE INDEX "match_join_request_status_idx" ON "public"."match_join_request"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_join_request_matchId_requesterId_key" ON "public"."match_join_request"("matchId", "requesterId");

-- CreateIndex
CREATE INDEX "bracket_status_idx" ON "public"."bracket"("status");

-- CreateIndex
CREATE INDEX "bracket_seasonId_idx" ON "public"."bracket"("seasonId");

-- CreateIndex
CREATE INDEX "bracket_divisionId_idx" ON "public"."bracket"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_seasonId_divisionId_key" ON "public"."bracket"("seasonId", "divisionId");

-- CreateIndex
CREATE INDEX "bracket_round_bracketId_idx" ON "public"."bracket_round"("bracketId");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_round_bracketId_roundNumber_key" ON "public"."bracket_round"("bracketId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_match_matchId_key" ON "public"."bracket_match"("matchId");

-- CreateIndex
CREATE INDEX "bracket_match_bracketId_idx" ON "public"."bracket_match"("bracketId");

-- CreateIndex
CREATE INDEX "bracket_match_roundId_idx" ON "public"."bracket_match"("roundId");

-- CreateIndex
CREATE INDEX "bracket_match_status_idx" ON "public"."bracket_match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_dispute_matchId_key" ON "public"."match_dispute"("matchId");

-- CreateIndex
CREATE INDEX "match_dispute_matchId_idx" ON "public"."match_dispute"("matchId");

-- CreateIndex
CREATE INDEX "match_dispute_raisedByUserId_idx" ON "public"."match_dispute"("raisedByUserId");

-- CreateIndex
CREATE INDEX "match_dispute_status_idx" ON "public"."match_dispute"("status");

-- CreateIndex
CREATE INDEX "match_dispute_priority_idx" ON "public"."match_dispute"("priority");

-- CreateIndex
CREATE INDEX "match_dispute_reviewedByAdminId_idx" ON "public"."match_dispute"("reviewedByAdminId");

-- CreateIndex
CREATE INDEX "dispute_admin_note_disputeId_createdAt_idx" ON "public"."dispute_admin_note"("disputeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "dispute_comment_disputeId_createdAt_idx" ON "public"."dispute_comment"("disputeId", "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "match_walkover_matchId_key" ON "public"."match_walkover"("matchId");

-- CreateIndex
CREATE INDEX "match_walkover_matchId_idx" ON "public"."match_walkover"("matchId");

-- CreateIndex
CREATE INDEX "match_walkover_defaultingPlayerId_idx" ON "public"."match_walkover"("defaultingPlayerId");

-- CreateIndex
CREATE INDEX "match_walkover_winningPlayerId_idx" ON "public"."match_walkover"("winningPlayerId");

-- CreateIndex
CREATE INDEX "match_walkover_adminVerified_idx" ON "public"."match_walkover"("adminVerified");

-- CreateIndex
CREATE INDEX "player_penalty_userId_status_idx" ON "public"."player_penalty"("userId", "status");

-- CreateIndex
CREATE INDEX "player_penalty_penaltyType_idx" ON "public"."player_penalty"("penaltyType");

-- CreateIndex
CREATE INDEX "player_penalty_status_idx" ON "public"."player_penalty"("status");

-- CreateIndex
CREATE INDEX "player_penalty_issuedByAdminId_idx" ON "public"."player_penalty"("issuedByAdminId");

-- CreateIndex
CREATE INDEX "player_penalty_expiresAt_idx" ON "public"."player_penalty"("expiresAt");

-- CreateIndex
CREATE INDEX "match_admin_action_matchId_createdAt_idx" ON "public"."match_admin_action"("matchId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "match_admin_action_adminId_createdAt_idx" ON "public"."match_admin_action"("adminId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "match_admin_action_actionType_idx" ON "public"."match_admin_action"("actionType");

-- CreateIndex
CREATE INDEX "player_rating_seasonId_divisionId_idx" ON "public"."player_rating"("seasonId", "divisionId");

-- CreateIndex
CREATE INDEX "player_rating_currentRating_idx" ON "public"."player_rating"("currentRating");

-- CreateIndex
CREATE INDEX "player_rating_isProvisional_idx" ON "public"."player_rating"("isProvisional");

-- CreateIndex
CREATE INDEX "player_rating_userId_idx" ON "public"."player_rating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "player_rating_userId_seasonId_gameType_key" ON "public"."player_rating"("userId", "seasonId", "gameType");

-- CreateIndex
CREATE INDEX "rating_history_playerRatingId_createdAt_idx" ON "public"."rating_history"("playerRatingId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "rating_history_matchId_idx" ON "public"."rating_history"("matchId");

-- CreateIndex
CREATE INDEX "match_score_matchId_idx" ON "public"."match_score"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "match_score_matchId_setNumber_key" ON "public"."match_score"("matchId", "setNumber");

-- CreateIndex
CREATE INDEX "match_result_playerId_datePlayed_idx" ON "public"."match_result"("playerId", "datePlayed");

-- CreateIndex
CREATE INDEX "match_result_playerId_countsForStandings_idx" ON "public"."match_result"("playerId", "countsForStandings");

-- CreateIndex
CREATE INDEX "match_result_playerId_resultSequence_idx" ON "public"."match_result"("playerId", "resultSequence");

-- CreateIndex
CREATE INDEX "match_result_matchId_idx" ON "public"."match_result"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "match_result_matchId_playerId_key" ON "public"."match_result"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "pickleball_game_score_matchId_idx" ON "public"."pickleball_game_score"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "pickleball_game_score_matchId_gameNumber_key" ON "public"."pickleball_game_score"("matchId", "gameNumber");

-- CreateIndex
CREATE INDEX "division_standing_divisionId_rank_idx" ON "public"."division_standing"("divisionId", "rank");

-- CreateIndex
CREATE INDEX "division_standing_seasonId_idx" ON "public"."division_standing"("seasonId");

-- CreateIndex
CREATE INDEX "division_standing_totalPoints_idx" ON "public"."division_standing"("totalPoints" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "division_standing_divisionId_seasonId_userId_key" ON "public"."division_standing"("divisionId", "seasonId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "division_standing_divisionId_seasonId_partnershipId_key" ON "public"."division_standing"("divisionId", "seasonId", "partnershipId");

-- CreateIndex
CREATE INDEX "rating_adjustment_playerRatingId_createdAt_idx" ON "public"."rating_adjustment"("playerRatingId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "rating_adjustment_adminId_idx" ON "public"."rating_adjustment"("adminId");

-- CreateIndex
CREATE INDEX "rating_parameters_leagueId_isActive_idx" ON "public"."rating_parameters"("leagueId", "isActive");

-- CreateIndex
CREATE INDEX "rating_parameters_seasonId_isActive_idx" ON "public"."rating_parameters"("seasonId", "isActive");

-- CreateIndex
CREATE INDEX "rating_parameters_effectiveFrom_idx" ON "public"."rating_parameters"("effectiveFrom");

-- CreateIndex
CREATE INDEX "rating_recalculation_status_idx" ON "public"."rating_recalculation"("status");

-- CreateIndex
CREATE INDEX "rating_recalculation_initiatedByAdminId_idx" ON "public"."rating_recalculation"("initiatedByAdminId");

-- CreateIndex
CREATE INDEX "rating_recalculation_createdAt_idx" ON "public"."rating_recalculation"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "season_lock_seasonId_key" ON "public"."season_lock"("seasonId");

-- CreateIndex
CREATE INDEX "season_lock_seasonId_idx" ON "public"."season_lock"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "inactivity_settings_leagueId_key" ON "public"."inactivity_settings"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "inactivity_settings_seasonId_key" ON "public"."inactivity_settings"("seasonId");

-- CreateIndex
CREATE INDEX "inactivity_settings_leagueId_idx" ON "public"."inactivity_settings"("leagueId");

-- CreateIndex
CREATE INDEX "inactivity_settings_seasonId_idx" ON "public"."inactivity_settings"("seasonId");

-- CreateIndex
CREATE INDEX "player_status_change_userId_createdAt_idx" ON "public"."player_status_change"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "player_status_change_newStatus_idx" ON "public"."player_status_change"("newStatus");

-- CreateIndex
CREATE INDEX "player_status_change_reason_idx" ON "public"."player_status_change"("reason");

-- CreateIndex
CREATE UNIQUE INDEX "app_code_key" ON "public"."app"("code");

-- CreateIndex
CREATE UNIQUE INDEX "app_name_key" ON "public"."app"("name");

-- CreateIndex
CREATE INDEX "app_isActive_idx" ON "public"."app"("isActive");

-- CreateIndex
CREATE INDEX "bug_module_appId_isActive_idx" ON "public"."bug_module"("appId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "bug_module_appId_code_key" ON "public"."bug_module"("appId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bug_report_reportNumber_key" ON "public"."bug_report"("reportNumber");

-- CreateIndex
CREATE INDEX "bug_report_appId_status_idx" ON "public"."bug_report"("appId", "status");

-- CreateIndex
CREATE INDEX "bug_report_appId_moduleId_idx" ON "public"."bug_report"("appId", "moduleId");

-- CreateIndex
CREATE INDEX "bug_report_reporterId_idx" ON "public"."bug_report"("reporterId");

-- CreateIndex
CREATE INDEX "bug_report_assignedToId_idx" ON "public"."bug_report"("assignedToId");

-- CreateIndex
CREATE INDEX "bug_report_status_priority_idx" ON "public"."bug_report"("status", "priority");

-- CreateIndex
CREATE INDEX "bug_report_createdAt_idx" ON "public"."bug_report"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "bug_report_reportNumber_idx" ON "public"."bug_report"("reportNumber");

-- CreateIndex
CREATE INDEX "bug_screenshot_bugReportId_idx" ON "public"."bug_screenshot"("bugReportId");

-- CreateIndex
CREATE INDEX "bug_comment_bugReportId_createdAt_idx" ON "public"."bug_comment"("bugReportId", "createdAt");

-- CreateIndex
CREATE INDEX "bug_comment_authorId_idx" ON "public"."bug_comment"("authorId");

-- CreateIndex
CREATE INDEX "bug_status_change_bugReportId_createdAt_idx" ON "public"."bug_status_change"("bugReportId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bug_report_settings_appId_key" ON "public"."bug_report_settings"("appId");

-- CreateIndex
CREATE INDEX "Achievement_category_idx" ON "public"."Achievement"("category");

-- CreateIndex
CREATE INDEX "Achievement_isActive_idx" ON "public"."Achievement"("isActive");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "public"."UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "public"."UserAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "public"."UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "UserThread_userId_idx" ON "public"."UserThread"("userId");

-- CreateIndex
CREATE INDEX "UserThread_threadId_idx" ON "public"."UserThread"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "UserThread_threadId_userId_key" ON "public"."UserThread"("threadId", "userId");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "public"."Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_matchId_idx" ON "public"."Message"("matchId");

-- CreateIndex
CREATE INDEX "friendship_requesterId_idx" ON "public"."friendship"("requesterId");

-- CreateIndex
CREATE INDEX "friendship_recipientId_idx" ON "public"."friendship"("recipientId");

-- CreateIndex
CREATE INDEX "friendship_status_idx" ON "public"."friendship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "friendship_requesterId_recipientId_key" ON "public"."friendship"("requesterId", "recipientId");

-- CreateIndex
CREATE INDEX "favorite_userId_idx" ON "public"."favorite"("userId");

-- CreateIndex
CREATE INDEX "favorite_favoritedId_idx" ON "public"."favorite"("favoritedId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_userId_favoritedId_key" ON "public"."favorite"("userId", "favoritedId");

-- CreateIndex
CREATE INDEX "pair_request_requesterId_idx" ON "public"."pair_request"("requesterId");

-- CreateIndex
CREATE INDEX "pair_request_recipientId_idx" ON "public"."pair_request"("recipientId");

-- CreateIndex
CREATE INDEX "pair_request_seasonId_idx" ON "public"."pair_request"("seasonId");

-- CreateIndex
CREATE INDEX "pair_request_status_idx" ON "public"."pair_request"("status");

-- CreateIndex
CREATE INDEX "partnership_seasonId_idx" ON "public"."partnership"("seasonId");

-- CreateIndex
CREATE INDEX "partnership_status_idx" ON "public"."partnership"("status");

-- CreateIndex
CREATE INDEX "partnership_captainId_idx" ON "public"."partnership"("captainId");

-- CreateIndex
CREATE INDEX "partnership_partnerId_idx" ON "public"."partnership"("partnerId");

-- CreateIndex
CREATE INDEX "partnership_captainId_seasonId_status_idx" ON "public"."partnership"("captainId", "seasonId", "status");

-- CreateIndex
CREATE INDEX "partnership_partnerId_seasonId_status_idx" ON "public"."partnership"("partnerId", "seasonId", "status");

-- CreateIndex
CREATE INDEX "season_invitation_senderId_idx" ON "public"."season_invitation"("senderId");

-- CreateIndex
CREATE INDEX "season_invitation_recipientId_idx" ON "public"."season_invitation"("recipientId");

-- CreateIndex
CREATE INDEX "season_invitation_seasonId_idx" ON "public"."season_invitation"("seasonId");

-- CreateIndex
CREATE INDEX "season_invitation_status_idx" ON "public"."season_invitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "season_invitation_senderId_recipientId_seasonId_key" ON "public"."season_invitation"("senderId", "recipientId", "seasonId");

-- CreateIndex
CREATE INDEX "notification_type_idx" ON "public"."notification"("type");

-- CreateIndex
CREATE INDEX "notification_createdAt_idx" ON "public"."notification"("createdAt");

-- CreateIndex
CREATE INDEX "user_notification_userId_read_idx" ON "public"."user_notification"("userId", "read");

-- CreateIndex
CREATE INDEX "user_notification_userId_archive_idx" ON "public"."user_notification"("userId", "archive");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_userId_notificationId_key" ON "public"."user_notification"("userId", "notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_userId_key" ON "public"."notification_preference"("userId");

-- CreateIndex
CREATE INDEX "_LeagueToSeason_B_index" ON "public"."_LeagueToSeason"("B");

-- CreateIndex
CREATE INDEX "_LeagueToSponsorship_B_index" ON "public"."_LeagueToSponsorship"("B");

-- CreateIndex
CREATE INDEX "_SeasonPromoCodes_B_index" ON "public"."_SeasonPromoCodes"("B");

-- AddForeignKey
ALTER TABLE "public"."Admin" ADD CONSTRAINT "Admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminInviteToken" ADD CONSTRAINT "AdminInviteToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InitialRatingResult" ADD CONSTRAINT "InitialRatingResult_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."QuestionnaireResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."League" ADD CONSTRAINT "League_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sponsorship" ADD CONSTRAINT "sponsorship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Season" ADD CONSTRAINT "Season_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Season" ADD CONSTRAINT "Season_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "public"."sponsorship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Waitlist" ADD CONSTRAINT "Waitlist_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WaitlistUser" ADD CONSTRAINT "WaitlistUser_waitlistId_fkey" FOREIGN KEY ("waitlistId") REFERENCES "public"."Waitlist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_processedByAdminId_fkey" FOREIGN KEY ("processedByAdminId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "public"."partnership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division" ADD CONSTRAINT "division_divisionSponsorId_fkey" FOREIGN KEY ("divisionSponsorId") REFERENCES "public"."sponsorship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division" ADD CONSTRAINT "division_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division" ADD CONSTRAINT "division_lastUpdatedByAdminId_fkey" FOREIGN KEY ("lastUpdatedByAdminId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division" ADD CONSTRAINT "division_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division" ADD CONSTRAINT "division_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonMembership" ADD CONSTRAINT "SeasonMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonMembership" ADD CONSTRAINT "SeasonMembership_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonMembership" ADD CONSTRAINT "SeasonMembership_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division_assignment" ADD CONSTRAINT "division_assignment_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division_assignment" ADD CONSTRAINT "division_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division_assignment" ADD CONSTRAINT "division_assignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_resultSubmittedById_fkey" FOREIGN KEY ("resultSubmittedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_resultConfirmedById_fkey" FOREIGN KEY ("resultConfirmedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_walkoverRecordedById_fkey" FOREIGN KEY ("walkoverRecordedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchStats" ADD CONSTRAINT "MatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_invitation" ADD CONSTRAINT "match_invitation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_invitation" ADD CONSTRAINT "match_invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_invitation" ADD CONSTRAINT "match_invitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_time_slot" ADD CONSTRAINT "match_time_slot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_time_slot" ADD CONSTRAINT "match_time_slot_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_join_request" ADD CONSTRAINT "match_join_request_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_join_request" ADD CONSTRAINT "match_join_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_join_request" ADD CONSTRAINT "match_join_request_respondedBy_fkey" FOREIGN KEY ("respondedBy") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket" ADD CONSTRAINT "bracket_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket" ADD CONSTRAINT "bracket_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket" ADD CONSTRAINT "bracket_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket_round" ADD CONSTRAINT "bracket_round_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "public"."bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket_match" ADD CONSTRAINT "bracket_match_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "public"."bracket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket_match" ADD CONSTRAINT "bracket_match_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "public"."bracket_round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket_match" ADD CONSTRAINT "bracket_match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket_match" ADD CONSTRAINT "bracket_match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bracket_match" ADD CONSTRAINT "bracket_match_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_dispute" ADD CONSTRAINT "match_dispute_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_dispute" ADD CONSTRAINT "match_dispute_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_dispute" ADD CONSTRAINT "match_dispute_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_dispute" ADD CONSTRAINT "match_dispute_resolvedByAdminId_fkey" FOREIGN KEY ("resolvedByAdminId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispute_admin_note" ADD CONSTRAINT "dispute_admin_note_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "public"."match_dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispute_admin_note" ADD CONSTRAINT "dispute_admin_note_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispute_comment" ADD CONSTRAINT "dispute_comment_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "public"."match_dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dispute_comment" ADD CONSTRAINT "dispute_comment_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_walkover" ADD CONSTRAINT "match_walkover_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_walkover" ADD CONSTRAINT "match_walkover_defaultingPlayerId_fkey" FOREIGN KEY ("defaultingPlayerId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_walkover" ADD CONSTRAINT "match_walkover_winningPlayerId_fkey" FOREIGN KEY ("winningPlayerId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_walkover" ADD CONSTRAINT "match_walkover_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_walkover" ADD CONSTRAINT "match_walkover_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_walkover" ADD CONSTRAINT "match_walkover_adminVerifiedBy_fkey" FOREIGN KEY ("adminVerifiedBy") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_walkover" ADD CONSTRAINT "match_walkover_penaltyId_fkey" FOREIGN KEY ("penaltyId") REFERENCES "public"."player_penalty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_penalty" ADD CONSTRAINT "player_penalty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_penalty" ADD CONSTRAINT "player_penalty_relatedMatchId_fkey" FOREIGN KEY ("relatedMatchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_penalty" ADD CONSTRAINT "player_penalty_relatedDisputeId_fkey" FOREIGN KEY ("relatedDisputeId") REFERENCES "public"."match_dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_penalty" ADD CONSTRAINT "player_penalty_issuedByAdminId_fkey" FOREIGN KEY ("issuedByAdminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_penalty" ADD CONSTRAINT "player_penalty_appealResolvedBy_fkey" FOREIGN KEY ("appealResolvedBy") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_admin_action" ADD CONSTRAINT "match_admin_action_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_admin_action" ADD CONSTRAINT "match_admin_action_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_rating" ADD CONSTRAINT "player_rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_rating" ADD CONSTRAINT "player_rating_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_rating" ADD CONSTRAINT "player_rating_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_history" ADD CONSTRAINT "rating_history_playerRatingId_fkey" FOREIGN KEY ("playerRatingId") REFERENCES "public"."player_rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_history" ADD CONSTRAINT "rating_history_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_score" ADD CONSTRAINT "match_score_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_result" ADD CONSTRAINT "match_result_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_result" ADD CONSTRAINT "match_result_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."match_result" ADD CONSTRAINT "match_result_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pickleball_game_score" ADD CONSTRAINT "pickleball_game_score_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division_standing" ADD CONSTRAINT "division_standing_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division_standing" ADD CONSTRAINT "division_standing_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division_standing" ADD CONSTRAINT "division_standing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."division_standing" ADD CONSTRAINT "division_standing_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "public"."partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_adjustment" ADD CONSTRAINT "rating_adjustment_playerRatingId_fkey" FOREIGN KEY ("playerRatingId") REFERENCES "public"."player_rating"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_adjustment" ADD CONSTRAINT "rating_adjustment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_parameters" ADD CONSTRAINT "rating_parameters_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_parameters" ADD CONSTRAINT "rating_parameters_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_parameters" ADD CONSTRAINT "rating_parameters_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_recalculation" ADD CONSTRAINT "rating_recalculation_initiatedByAdminId_fkey" FOREIGN KEY ("initiatedByAdminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_lock" ADD CONSTRAINT "season_lock_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_lock" ADD CONSTRAINT "season_lock_lockedByAdminId_fkey" FOREIGN KEY ("lockedByAdminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_lock" ADD CONSTRAINT "season_lock_overrideByAdminId_fkey" FOREIGN KEY ("overrideByAdminId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inactivity_settings" ADD CONSTRAINT "inactivity_settings_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inactivity_settings" ADD CONSTRAINT "inactivity_settings_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inactivity_settings" ADD CONSTRAINT "inactivity_settings_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "public"."Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_status_change" ADD CONSTRAINT "player_status_change_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_status_change" ADD CONSTRAINT "player_status_change_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_status_change" ADD CONSTRAINT "player_status_change_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_module" ADD CONSTRAINT "bug_module_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."app"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_report" ADD CONSTRAINT "bug_report_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."app"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_report" ADD CONSTRAINT "bug_report_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "public"."bug_module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_report" ADD CONSTRAINT "bug_report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_report" ADD CONSTRAINT "bug_report_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_report" ADD CONSTRAINT "bug_report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_report" ADD CONSTRAINT "bug_report_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "public"."bug_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_screenshot" ADD CONSTRAINT "bug_screenshot_bugReportId_fkey" FOREIGN KEY ("bugReportId") REFERENCES "public"."bug_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_comment" ADD CONSTRAINT "bug_comment_bugReportId_fkey" FOREIGN KEY ("bugReportId") REFERENCES "public"."bug_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_comment" ADD CONSTRAINT "bug_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_comment" ADD CONSTRAINT "bug_comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."bug_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_status_change" ADD CONSTRAINT "bug_status_change_bugReportId_fkey" FOREIGN KEY ("bugReportId") REFERENCES "public"."bug_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_status_change" ADD CONSTRAINT "bug_status_change_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_report_settings" ADD CONSTRAINT "bug_report_settings_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."app"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bug_report_settings" ADD CONSTRAINT "bug_report_settings_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "public"."Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Thread" ADD CONSTRAINT "Thread_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserThread" ADD CONSTRAINT "UserThread_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserThread" ADD CONSTRAINT "UserThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_repliesToId_fkey" FOREIGN KEY ("repliesToId") REFERENCES "public"."Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friendship" ADD CONSTRAINT "friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friendship" ADD CONSTRAINT "friendship_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite" ADD CONSTRAINT "favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite" ADD CONSTRAINT "favorite_favoritedId_fkey" FOREIGN KEY ("favoritedId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pair_request" ADD CONSTRAINT "pair_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pair_request" ADD CONSTRAINT "pair_request_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pair_request" ADD CONSTRAINT "pair_request_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnership" ADD CONSTRAINT "partnership_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnership" ADD CONSTRAINT "partnership_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnership" ADD CONSTRAINT "partnership_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."partnership" ADD CONSTRAINT "partnership_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_invitation" ADD CONSTRAINT "season_invitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_invitation" ADD CONSTRAINT "season_invitation_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_invitation" ADD CONSTRAINT "season_invitation_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "public"."Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "public"."division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "public"."partnership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."Thread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_pairRequestId_fkey" FOREIGN KEY ("pairRequestId") REFERENCES "public"."pair_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification" ADD CONSTRAINT "notification_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "public"."WithdrawalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_notification" ADD CONSTRAINT "user_notification_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "public"."notification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_notification" ADD CONSTRAINT "user_notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_preference" ADD CONSTRAINT "notification_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LeagueToSeason" ADD CONSTRAINT "_LeagueToSeason_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LeagueToSeason" ADD CONSTRAINT "_LeagueToSeason_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LeagueToSponsorship" ADD CONSTRAINT "_LeagueToSponsorship_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LeagueToSponsorship" ADD CONSTRAINT "_LeagueToSponsorship_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."sponsorship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SeasonPromoCodes" ADD CONSTRAINT "_SeasonPromoCodes_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SeasonPromoCodes" ADD CONSTRAINT "_SeasonPromoCodes_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
