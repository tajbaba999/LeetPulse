import bcrypt from "bcrypt";
import express from "express";
import { z } from "zod/v4";

import type { SingupResponse } from "../../interfaces/singup.js";

import prisma from "@leetplus/db";
import { generateAccessToken, generateRefreshToken } from "../../utils/tokens.js";
import { signupSchema } from "../../validators/index.js";

const router = express.Router();

const SALT_ROUNDS = 10;

router.post<object, SingupResponse>("/", async (req, res) => {
  try {
    const result = signupSchema.safeParse(req.body);
    if (!result.success) {
      req.log.warn("Signup request failed validation");
      res.status(422).json({ error: z.prettifyError(result.error) });
      return;
    }

    const { name, email, password } = result.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      req.log.warn({ email }, "Signup attempt with already registered email");
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    req.log.info({ userId: user.id, email }, "User registered successfully");
    res.status(201).json({ accessToken, refreshToken });
  }
  catch (error: unknown) {
    req.log.error({ err: error }, "Failed to register user");
    res.status(500).json({ error: "An error occurred while registering the user" });
  }
});

export default router;
