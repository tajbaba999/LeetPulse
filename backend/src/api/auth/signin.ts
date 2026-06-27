import bcrypt from "bcrypt";
import express from "express";
import { z } from "zod/v4";

import type { SigninResponse, SinginRequest } from "../../interfaces/signin.js";

import prisma from "../../db.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/tokens.js";
import { signinSchema } from "../../validators/signin.validator.js";

const router = express.Router();

router.post<SinginRequest, SigninResponse>("/", async (req, res) => {
  try {
    const result = signinSchema.safeParse(req.body);
    if (!result.success) {
      req.log.warn("Signin request failed validation");
      res.status(422).json({ error: z.prettifyError(result.error) });
      return;
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      req.log.warn({ email }, "Signin attempt for unregistered email");
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      req.log.warn({ userId: user.id, email }, "Signin failed: incorrect password");
      return res.status(401).json({ error: "Invalid password" });
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    req.log.info({ userId: user.id, email }, "User signed in successfully");
    res.status(200).json({ accessToken, refreshToken });
  }
  catch (error) {
    req.log.error({ err: error }, "Failed to sign in user");
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
