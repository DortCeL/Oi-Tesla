import { RideType } from "@prisma/client";
import { z } from "zod";

export const acceptRequestStackSchema = z.object({
  pickupZoneId: z.number().int().positive(),
  destinationZoneId: z.number().int().positive(),
  type: z.nativeEnum(RideType),
  stackKey: z.string().min(1).optional(),
});

export type AcceptRequestStackInput = z.infer<typeof acceptRequestStackSchema>;
