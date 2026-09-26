-- DropForeignKey
ALTER TABLE "passengers" DROP CONSTRAINT "passengers_address_zone_id_fkey";

-- AlterTable
ALTER TABLE "passengers" DROP COLUMN "address_zone_id";
