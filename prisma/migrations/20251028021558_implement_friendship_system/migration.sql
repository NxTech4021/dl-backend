-- CreateEnum
CREATE TYPE "public"."MediaType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'VOICE_NOTE', 'DOCUMENT', 'SYSTEM');

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
    "status" TEXT NOT NULL DEFAULT 'active',
    "bio" TEXT,
    "phoneNumber" TEXT,

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
CREATE TABLE "public"."LeagueMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255),
    "genderRestriction" "public"."GenderRestriction" NOT NULL DEFAULT 'OPEN',
    "matchFormat" TEXT,
    "game_type" "public"."GameType",
    "gender_category" "public"."GenderType",
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
    "status" TEXT NOT NULL DEFAULT 'PENDING',
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
    "sport" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "playerScore" INTEGER,
    "opponentScore" INTEGER,
    "outcome" TEXT,
    "matchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "notes" TEXT,
    "duration" INTEGER,
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
    "type" "public"."MediaType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "repliesToId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessageReadBy" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MessageReadBy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."File" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeKB" INTEGER NOT NULL,
    "fileName" TEXT,
    "isMedia" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "public"."_CategoryToLeague" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToLeague_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_CategoryToSeason" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToSeason_AB_pkey" PRIMARY KEY ("A","B")
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
CREATE INDEX "LeagueMembership_leagueId_idx" ON "public"."LeagueMembership"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueMembership_userId_idx" ON "public"."LeagueMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMembership_userId_leagueId_key" ON "public"."LeagueMembership"("userId", "leagueId");

-- CreateIndex
CREATE INDEX "Category_isActive_idx" ON "public"."Category"("isActive");

-- CreateIndex
CREATE INDEX "Season_status_idx" ON "public"."Season"("status");

-- CreateIndex
CREATE INDEX "Season_isActive_idx" ON "public"."Season"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_seasonId_key" ON "public"."Waitlist"("seasonId");

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
CREATE INDEX "Match_divisionId_idx" ON "public"."Match"("divisionId");

-- CreateIndex
CREATE INDEX "Match_sport_idx" ON "public"."Match"("sport");

-- CreateIndex
CREATE INDEX "Match_matchDate_idx" ON "public"."Match"("matchDate");

-- CreateIndex
CREATE INDEX "MatchParticipant_userId_idx" ON "public"."MatchParticipant"("userId");

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_idx" ON "public"."MatchParticipant"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipant_matchId_userId_key" ON "public"."MatchParticipant"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchStats_matchId_key" ON "public"."MatchStats"("matchId");

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
CREATE UNIQUE INDEX "UserThread_threadId_userId_key" ON "public"."UserThread"("threadId", "userId");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "public"."Message"("threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReadBy_messageId_userId_key" ON "public"."MessageReadBy"("messageId", "userId");

-- CreateIndex
CREATE INDEX "File_messageId_idx" ON "public"."File"("messageId");

-- CreateIndex
CREATE INDEX "friendship_requesterId_idx" ON "public"."friendship"("requesterId");

-- CreateIndex
CREATE INDEX "friendship_recipientId_idx" ON "public"."friendship"("recipientId");

-- CreateIndex
CREATE INDEX "friendship_status_idx" ON "public"."friendship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "friendship_requesterId_recipientId_key" ON "public"."friendship"("requesterId", "recipientId");

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
CREATE UNIQUE INDEX "partnership_captainId_seasonId_key" ON "public"."partnership"("captainId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "partnership_partnerId_seasonId_key" ON "public"."partnership"("partnerId", "seasonId");

-- CreateIndex
CREATE INDEX "season_invitation_senderId_idx" ON "public"."season_invitation"("senderId");

-- CreateIndex
CREATE INDEX "season_invitation_recipientId_idx" ON "public"."season_invitation"("recipientId");

-- CreateIndex
CREATE INDEX "season_invitation_seasonId_idx" ON "public"."season_invitation"("seasonId");

-- CreateIndex
CREATE INDEX "season_invitation_status_idx" ON "public"."season_invitation"("status");

-- CreateIndex
CREATE INDEX "_LeagueToSeason_B_index" ON "public"."_LeagueToSeason"("B");

-- CreateIndex
CREATE INDEX "_LeagueToSponsorship_B_index" ON "public"."_LeagueToSponsorship"("B");

-- CreateIndex
CREATE INDEX "_CategoryToLeague_B_index" ON "public"."_CategoryToLeague"("B");

-- CreateIndex
CREATE INDEX "_CategoryToSeason_B_index" ON "public"."_CategoryToSeason"("B");

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
ALTER TABLE "public"."LeagueMembership" ADD CONSTRAINT "LeagueMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeagueMembership" ADD CONSTRAINT "LeagueMembership_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sponsorship" ADD CONSTRAINT "sponsorship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "public"."MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MatchStats" ADD CONSTRAINT "MatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_repliesToId_fkey" FOREIGN KEY ("repliesToId") REFERENCES "public"."Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageReadBy" ADD CONSTRAINT "MessageReadBy_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageReadBy" ADD CONSTRAINT "MessageReadBy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friendship" ADD CONSTRAINT "friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friendship" ADD CONSTRAINT "friendship_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."_LeagueToSeason" ADD CONSTRAINT "_LeagueToSeason_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LeagueToSeason" ADD CONSTRAINT "_LeagueToSeason_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LeagueToSponsorship" ADD CONSTRAINT "_LeagueToSponsorship_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_LeagueToSponsorship" ADD CONSTRAINT "_LeagueToSponsorship_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."sponsorship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToLeague" ADD CONSTRAINT "_CategoryToLeague_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToLeague" ADD CONSTRAINT "_CategoryToLeague_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToSeason" ADD CONSTRAINT "_CategoryToSeason_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CategoryToSeason" ADD CONSTRAINT "_CategoryToSeason_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SeasonPromoCodes" ADD CONSTRAINT "_SeasonPromoCodes_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_SeasonPromoCodes" ADD CONSTRAINT "_SeasonPromoCodes_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
