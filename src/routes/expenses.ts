import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import { BadRequestError } from "../middleware/errorHandler";

const router = Router();

const createExpenseSchema = z.object({
  category: z.enum(["fuel", "food", "maintenance", "fine", "rental", "financing", "insurance", "other"]),
  amount: z.number().min(0.01),
  description: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.enum(["pix", "credit", "debit", "cash"]).optional(),
});

router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month } = req.query;

    if (!month || typeof month !== "string") {
      throw new BadRequestError("Informe o mês no formato YYYY-MM");
    }

    const result = await db.query(
      `SELECT * FROM expenses
       WHERE user_id = $1
         AND TO_CHAR(date, 'YYYY-MM') = $2
       ORDER BY date DESC`,
      [req.userId, month],
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createExpenseSchema.parse(req.body);

    const result = await db.query(
      `INSERT INTO expenses (user_id, category, amount, description, date, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, data.category, data.amount, data.description ?? null, data.date, data.payment_method ?? null],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
