-- AlterTable: Change duration from Int to Float to support half-hour increments (0.5, 1.5, 2.5)
ALTER TABLE "Match" ALTER COLUMN "duration" TYPE DOUBLE PRECISION;
