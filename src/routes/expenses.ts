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

router.delete("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id`, [id, req.userId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Despesa não encontrada" });
    }

    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

const updateExpenseSchema = z.object({
  category: z.enum(["fuel", "food", "maintenance", "fine", "rental", "financing", "insurance", "other"]).optional(),
  amount: z.number().min(0.01).optional(),
  description: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  payment_method: z.enum(["pix", "credit", "debit", "cash"]).nullable().optional(),
});

router.patch("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = updateExpenseSchema.parse(req.body);

    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(", ");

    const result = await db.query(
      `UPDATE expenses SET ${setClause}
       WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2}
       RETURNING *`,
      [...values, id, req.userId],
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Despesa não encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
