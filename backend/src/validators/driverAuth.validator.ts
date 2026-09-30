import { z } from "zod";
import { nidSchema } from "./nid.js";

export const driverRegisterSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(10).max(20),
  nid: nidSchema,
  password: z.string().min(8).max(128),
  gender: z.enum(["MALE", "FEMALE"]),
  tesla: z.object({
    name: z.string().trim().min(1).max(100),
    capacity: z.number().int().min(1).max(20).default(3),
  }),
});

export const driverLoginSchema = z.object({
  emailOrPhone: z.string().trim().min(1),
  password: z.string().min(1),
});

export type DriverRegisterInput = z.infer<typeof driverRegisterSchema>;
export type DriverLoginInput = z.infer<typeof driverLoginSchema>;
