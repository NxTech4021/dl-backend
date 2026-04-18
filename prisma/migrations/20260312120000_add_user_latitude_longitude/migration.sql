-- Add latitude and longitude columns to user table
ALTER TABLE "public"."user" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "public"."user" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
