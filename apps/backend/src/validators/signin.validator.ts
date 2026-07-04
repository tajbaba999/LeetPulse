import { z } from "zod/v4";

export const signinSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SigninInput = z.infer<typeof signinSchema>;
