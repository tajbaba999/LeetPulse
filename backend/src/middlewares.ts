import type { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";

import type ErrorResponse from "./interfaces/error-response.js";

import { env } from "./env.js";
import { verifyAccessToken, verifyRefreshToken } from "./utils/tokens.js";
import { refreshTokenSchema } from "./validators/refreshtoken.validator.js";

export function notFound(req: Request, res: Response, next: NextFunction) {
  res.status(404);
  const error = new Error(`🔍 - Not Found - ${req.originalUrl}`);
  next(error);
}

export function errorHandler(err: Error, req: Request, res: Response<ErrorResponse>, _next: NextFunction) {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: env.NODE_ENV === "production" ? "🥞" : err.stack,
  });
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!accessToken) {
    return res.status(401).json({ message: "Access token is required" });
  }

  try {
    const { userId, email } = verifyAccessToken(accessToken);
    req.user = { userId, email };
    return next();
  }
  catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Access token expired, call /refresh-token to get a new one" });
    }
    return res.status(401).json({ message: "Invalid access token" });
  }
}

// Alias for backwards compatibility
export const authicateToken = authenticateToken;

export function refreshTokenValidaiton(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Extract raw token supporting both "Bearer <token>" and raw "<token>"
  const parts = authHeader.split(" ");
  const rawToken = parts.length > 1 ? parts[1] : parts[0];

  const result = refreshTokenSchema.safeParse({ refreshToken: rawToken });
  if (!result.success) {
    return res.status(422).json({ error: "Invalid refresh token format" });
  }

  const { refreshToken } = result.data;

  try {
    const payload = verifyRefreshToken(refreshToken);
    req.user = payload;
    return next();
  }
  catch (error) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
}
