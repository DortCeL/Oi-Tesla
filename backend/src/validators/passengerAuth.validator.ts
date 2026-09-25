import { z } from "zod";

export const passengerRegisterSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(10).max(20),
  password: z.string().min(8).max(128),
  gender: z.enum(["MALE", "FEMALE"]),
  addressZoneId: z.number().int().positive(),
  occupation: z.string().trim().min(1).max(100),
  affiliation: z.string().trim().min(1).max(200).optional(),
});

export const passengerLoginSchema = z.object({
  emailOrPhone: z.string().trim().min(1),
  password: z.string().min(1),
});

export type PassengerRegisterInput = z.infer<typeof passengerRegisterSchema>;
export type PassengerLoginInput = z.infer<typeof passengerLoginSchema>;
