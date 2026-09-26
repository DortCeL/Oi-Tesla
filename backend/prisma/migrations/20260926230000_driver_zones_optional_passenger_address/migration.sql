-- DropForeignKey
ALTER TABLE "passengers" DROP CONSTRAINT "passengers_address_zone_id_fkey";

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN "active_zone_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "passengers" ALTER COLUMN "address_zone_id" DROP NOT NULL;
ALTER TABLE "passengers" ALTER COLUMN "occupation" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_address_zone_id_fkey" FOREIGN KEY ("address_zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
