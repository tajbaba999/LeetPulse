import z from "zod";

export const codingProfileSchema = z.object({
    leetcode: z.url().optional(),
    codeforces: z.url().optional(),
    codechef: z.url().optional(),
    hackerrank: z.url().optional(),
    geeksforgeeks: z.url().optional()
});

export type CodingProfileInput = z.infer<typeof codingProfileSchema>