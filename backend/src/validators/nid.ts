import { z } from "zod";

/** Bangladesh NID: 10-digit (old), 13-digit, or 17-digit (SMART). Digits only. */
export const nidSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$|^\d{13}$|^\d{17}$/, "NID must be 10, 13, or 17 digits");
