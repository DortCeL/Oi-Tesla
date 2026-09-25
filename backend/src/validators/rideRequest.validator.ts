import { RideType } from "@prisma/client";
import { z } from "zod";

export const rideRequestEstimateSchema = z
  .object({
    pickupZoneId: z.number().int().positive(),
    destinationZoneId: z.number().int().positive(),
    type: z.nativeEnum(RideType),
    seatsRequested: z.union([z.literal(1), z.literal(2)]),
  })
  .refine((data) => data.pickupZoneId !== data.destinationZoneId, {
    message: "Pickup and destination must be different zones",
    path: ["destinationZoneId"],
  });

export type RideRequestEstimateInput = z.infer<typeof rideRequestEstimateSchema>;
