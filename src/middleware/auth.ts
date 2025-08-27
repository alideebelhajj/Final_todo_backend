// File: src/middleware/auth.ts

import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key";

/**
 * Extend Express's Request with `cookies` (from cookie-parser)
 * and an optional `userId` property.
 */
export interface AuthRequest extends Request {
  cookies: Record<string, string>;
  userId?: string;
}

/**
 * The shape of the context object your GraphQL resolvers expect.
 */
export interface AuthContext {
  userId?: string;
}

/**
 * Express middleware: reads the JWT from the "token" cookie,
 * verifies it, and stores userId on req.userId.
 */
export function jwtAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(
        token,
        JWT_SECRET
      ) as JwtPayload & { userId: string };
      if (payload.userId) {
        req.userId = payload.userId;
      }
    } catch (err) {
      console.error("JWT verification failed:", err);
    }
  }
  next();
}

/**
 * Protects Express routes. If there's no req.userId,
 * redirects to the login page.
 */
export function ensureAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.userId) {
    return res.redirect("/login");
  }
  next();
}

/**
 * For Apollo Server context: take an Express request,
 * read/verify the JWT cookie, and return an AuthContext.
 */
export function authMiddleware(req: AuthRequest): AuthContext {
  const context: AuthContext = {};
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(
        token,
        JWT_SECRET
      ) as JwtPayload & { userId: string };
      if (payload.userId) {
        context.userId = payload.userId;
      }
    } catch (err) {
      console.error("Invalid JWT in GraphQL context:", err);
    }
  }
  return context;
}
