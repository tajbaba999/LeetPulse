import { z } from "zod/v4";

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").trim(),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(/[^a-z0-9]/i, "Password must contain at least one special character"),
});

export type SignupInput = z.infer<typeof signupSchema>;
