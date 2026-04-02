import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado") {
    super(404, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autorizado") {
    super(401, message);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Dados inválidos") {
    super(400, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado") {
    super(403, message);
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error("Erro inesperado:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
}
