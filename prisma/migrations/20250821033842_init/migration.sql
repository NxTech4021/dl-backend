-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestionnaireResponse" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
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
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "gender" VARCHAR(20) NOT NULL,
    "birthDate" DATE NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserLocation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_id_key" ON "public"."Admin"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "public"."Admin"("email");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_userId_idx" ON "public"."QuestionnaireResponse"("userId");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_sport_qVersion_idx" ON "public"."QuestionnaireResponse"("sport", "qVersion");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_qHash_idx" ON "public"."QuestionnaireResponse"("qHash");

-- CreateIndex
CREATE UNIQUE INDEX "InitialRatingResult_responseId_key" ON "public"."InitialRatingResult"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserLocation_userId_key" ON "public"."UserLocation"("userId");

-- AddForeignKey
ALTER TABLE "public"."InitialRatingResult" ADD CONSTRAINT "InitialRatingResult_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."QuestionnaireResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
