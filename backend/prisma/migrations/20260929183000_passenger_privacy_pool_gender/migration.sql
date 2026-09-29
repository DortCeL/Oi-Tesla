-- Passengers no longer share occupation, affiliation, or hobbies.
ALTER TABLE "users" DROP COLUMN "hobbies";
ALTER TABLE "passengers" DROP COLUMN "occupation";
ALTER TABLE "passengers" DROP COLUMN "affiliation";

-- Shared bookings can ask to ride only with women or only with men.
CREATE TYPE "PoolGenderPreference" AS ENUM ('ANY', 'FEMALE_ONLY', 'MALE_ONLY');

ALTER TABLE "ride_requests"
ADD COLUMN "pool_gender" "PoolGenderPreference" NOT NULL DEFAULT 'ANY';
