-- Add optional points threshold column for divisions
ALTER TABLE "public"."Division"
ADD COLUMN "pointsThreshold" INTEGER;
