-- CreateEnum
CREATE TYPE "InviteType" AS ENUM ('EMAIL', 'LINK');

-- AlterTable
ALTER TABLE "invites" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "type" "InviteType" NOT NULL DEFAULT 'EMAIL';
