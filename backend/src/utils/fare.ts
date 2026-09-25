import type { RideType } from "@prisma/client";

const BASE_FARE_PAISA = 3000;
const PAISA_PER_KM = 1500;
const SHARED_DISCOUNT_RATE = 0.2;

export type FareBreakdown = {
  distanceM: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  poolDiscountPaisa: number;
  farePaisa: number;
};

export function calculateFare(
  distanceM: number,
  type: RideType,
): FareBreakdown {
  const baseFarePaisa = BASE_FARE_PAISA;
  const distanceChargePaisa = Math.round((distanceM / 1000) * PAISA_PER_KM);
  const subtotal = baseFarePaisa + distanceChargePaisa;
  const poolDiscountPaisa =
    type === "SHARED" ? Math.round(subtotal * SHARED_DISCOUNT_RATE) : 0;

  return {
    distanceM,
    baseFarePaisa,
    distanceChargePaisa,
    poolDiscountPaisa,
    farePaisa: subtotal - poolDiscountPaisa,
  };
}
