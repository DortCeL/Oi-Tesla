import { z } from "zod";

export const setDriverStatusSchema = z
  .object({
    isOnline: z.boolean(),
    zoneIds: z.array(z.number().int().positive()).optional(),
  })
  .refine((data) => !data.isOnline || (data.zoneIds?.length ?? 0) > 0, {
    message: "At least one zone is required when going online",
    path: ["zoneIds"],
  });

export type SetDriverStatusInput = z.infer<typeof setDriverStatusSchema>;
