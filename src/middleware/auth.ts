import { createClerkClient } from "@clerk/clerk-sdk-node";
import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "./errorHandler";
import { db } from "../db/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new UnauthorizedError());
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await clerk.verifyToken(token);
    const result = await db.query("SELECT id FROM users WHERE clerk_id = $1", [payload.sub]);
    req.userId = result.rows[0]?.id;
    next();
  } catch {
    next(new UnauthorizedError());
  }
}
