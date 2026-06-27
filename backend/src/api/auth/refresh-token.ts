import express from "express";
import { z } from "zod/v4";

import type { RefreshTokenRequest, RefreshTokenResponse } from "../../interfaces/refresh-token.js";

import { generateAccessToken, verifyRefreshToken } from "../../utils/tokens.js";
import { refreshTokenSchema } from "../../validators/refreshtoken.validator.js";

const router = express.Router();

router.post<object, RefreshTokenResponse, RefreshTokenRequest>("/", (req, res) => {
  const result = refreshTokenSchema.safeParse(req.body);
  if (!result.success) {
    req.log.warn("Refresh token request failed validation");
    res.status(422).json({ error: z.prettifyError(result.error) });
    return;
  }

  try {
    const { userId, email } = verifyRefreshToken(result.data.refreshToken);
    const accessToken = generateAccessToken({ userId, email });
    req.log.info({ userId, email }, "Access token refreshed successfully");
    res.status(200).json({ accessToken });
  }
  catch {
    req.log.warn("Refresh token invalid or expired");
    res.status(401).json({ error: "Refresh token is invalid or expired, please log in again" });
  }
});

export default router;
