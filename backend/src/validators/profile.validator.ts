import z from "zod";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be at most 50 characters")
  .regex(/^[\w.\-]+$/, "Username may only contain letters, numbers, underscores, hyphens, and dots");

export const codingProfileSchema = z.object({
  leetcode: usernameSchema.optional(),
  codeforces: usernameSchema.optional(),
  codechef: usernameSchema.optional(),
  hackerrank: usernameSchema.optional(),
  geeksforgeeks: usernameSchema.optional(),
});

export type CodingProfileInput = z.infer<typeof codingProfileSchema>;
