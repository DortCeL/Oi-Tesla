import type { RideType } from "@prisma/client";

const BASE_FARE_PAISA = 3000;
const PAISA_PER_KM = 1500;
const SHARED_DISCOUNT_RATE = 0.6;

export type FareBreakdown = {
  distanceM: number;
  baseFarePaisa: number;
  distanceChargePaisa: number;
  poolDiscountPaisa: number;
  farePaisa: number;
};

/**
 * Shared rides get a 60% discount on the per-seat price, then that price
 * is multiplied by the number of seats. A fully reserved ride is one price.
 */
export function calculateFare(
  distanceM: number,
  type: RideType,
  seatsRequested: 1 | 2 = 1,
): FareBreakdown {
  const baseFarePaisa = BASE_FARE_PAISA;
  const distanceChargePaisa = Math.round((distanceM / 1000) * PAISA_PER_KM);
  const subtotal = baseFarePaisa + distanceChargePaisa;
  const poolDiscountPaisa =
    type === "SHARED" ? Math.round(subtotal * SHARED_DISCOUNT_RATE) : 0;
  const perSeatFare = subtotal - poolDiscountPaisa;
  const seats = type === "SHARED" ? seatsRequested : 1;

  return {
    distanceM,
    baseFarePaisa: baseFarePaisa * seats,
    distanceChargePaisa: distanceChargePaisa * seats,
    poolDiscountPaisa: poolDiscountPaisa * seats,
    farePaisa: perSeatFare * seats,
  };
}
