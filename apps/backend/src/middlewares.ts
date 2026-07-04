import type { NextFunction, Request, Response } from "express";

import type ErrorResponse from "./interfaces/error-response.js";

import { env } from "./env.js";
import { verifyAccessToken } from "./utils/tokens.js";
import { refreshTokenSchema } from "./validators/refreshtoken.validator.js";

export function notFound(req: Request, res: Response, next: NextFunction) {
  req.log.warn({ url: req.originalUrl, method: req.method }, "Route not found");
  res.status(404);
  const error = new Error(`Not Found - ${req.originalUrl}`);
  next(error);
}

export function errorHandler(err: Error, req: Request, res: Response<ErrorResponse>, _next: NextFunction) {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode);

  if (statusCode >= 500) {
    req.log.error({ err, statusCode }, "Unhandled server error");
  }
  else {
    req.log.warn({ err: err.message, statusCode }, "Request error");
  }

  res.json({
    message: err.message,
    stack: env.NODE_ENV === "production" ? undefined : err.stack,
  });
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.log.warn({ url: req.originalUrl }, "Missing or malformed Authorization header");
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  }
  catch {
    req.log.warn({ url: req.originalUrl }, "Invalid or expired access token");
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function refreshTokenValidaiton(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[0];
  const result = refreshTokenSchema.safeParse(token);

  if (!result.success) {
    return res.status(422).json({ error: "Invalid refresh token" });
  }

  next();
}
