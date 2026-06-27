import bcrypt from "bcrypt";
import express from "express";
import { z } from "zod/v4";

import type { SingupResponse } from "../../interfaces/singup.js";

import prisma from "../../db.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/tokens.js";
import { signupSchema } from "../../validators/index.js";

const router = express.Router();

const SALT_ROUNDS = 10;

router.post<object, SingupResponse>("/", async (req, res) => {
  try {
    // 1. Validate request body with Zod
    const result = signupSchema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        error: z.prettifyError(result.error),
      });
      return;
    }

    const { name, email, password } = result.data;

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    // 3. Hash the password with bcrypt (10 salt rounds)
    const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);

    // 4. Create user with hashed password
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    // 5. Generate access token (15 min) + refresh token (7 days)
    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.status(201).json({ accessToken, refreshToken });
  }
  catch (error: unknown) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "An error occurred while registering the user" });
  }
});

export default router;
