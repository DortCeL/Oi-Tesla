import { PaymentMethod, PoolGenderPreference, RideType } from "@prisma/client";
import { z } from "zod";

const rideRequestTripFields = z.object({
  pickupZoneId: z.number().int().positive(),
  destinationZoneId: z.number().int().positive(),
  type: z.nativeEnum(RideType),
  seatsRequested: z.union([z.literal(1), z.literal(2)]),
});

export const rideRequestEstimateSchema = rideRequestTripFields.refine(
  (data) => data.pickupZoneId !== data.destinationZoneId,
  {
    message: "Pickup and destination must be different zones",
    path: ["destinationZoneId"],
  },
);

export const rideRequestCreateSchema = rideRequestTripFields
  .extend({
    paymentMethod: z.nativeEnum(PaymentMethod),
    poolGender: z.nativeEnum(PoolGenderPreference).optional(),
  })
  .refine((data) => data.pickupZoneId !== data.destinationZoneId, {
    message: "Pickup and destination must be different zones",
    path: ["destinationZoneId"],
  });

export type RideRequestEstimateInput = z.infer<typeof rideRequestEstimateSchema>;
export type RideRequestCreateInput = z.infer<typeof rideRequestCreateSchema>;
