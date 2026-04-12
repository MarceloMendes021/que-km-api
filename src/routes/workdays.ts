import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import { BadRequestError, NotFoundError } from "../middleware/errorHandler";

const router = Router();

const startWorkdaySchema = z.object({
  start_odometer: z.number().min(0),
});

const finishWorkdaySchema = z.object({
  end_odometer: z.number().min(0),
  earnings_uber: z.number().min(0).default(0),
  earnings_99: z.number().min(0).default(0),
  earnings_particular: z.number().min(0).default(0),
  expenses_fuel: z.number().min(0).default(0),
  expenses_food: z.number().min(0).default(0),
  expenses_other: z.number().min(0).default(0),
});

router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start_odometer } = startWorkdaySchema.parse(req.body);

    const active = await db.query(
      `SELECT id FROM workdays 
       WHERE user_id = $1 AND status = 'active'`,
      [req.userId],
    );

    if (active.rows[0]) {
      throw new BadRequestError("Já existe uma jornada ativa");
    }

    const result = await db.query(
      `INSERT INTO workdays (user_id, date, start_odometer, status)
       VALUES ($1, CURRENT_DATE, $2, 'active')
       RETURNING *`,
      [req.userId, start_odometer],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/active", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT * FROM workdays 
       WHERE user_id = $1 AND status = 'active'`,
      [req.userId],
    );

    res.json(result.rows[0] ?? null);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/finish", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = finishWorkdaySchema.parse(req.body);

    const workday = await db.query(
      `SELECT * FROM workdays 
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [id, req.userId],
    );

    if (!workday.rows[0]) {
      throw new NotFoundError("Jornada não encontrada ou já encerrada");
    }

    if (data.end_odometer < workday.rows[0].start_odometer) {
      throw new BadRequestError("KM final não pode ser menor que o KM inicial");
    }

    const result = await db.query(
      `UPDATE workdays SET
         end_odometer = $1,
         earnings_uber = $2,
         earnings_99 = $3,
         earnings_particular = $4,
         status = 'finished',
         updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [data.end_odometer, data.earnings_uber, data.earnings_99, data.earnings_particular, id, req.userId],
    );

    const workdayDate = workday.rows[0].date;

    if (data.expenses_fuel > 0) {
      await db.query(
        `INSERT INTO expenses (user_id, workday_id, category, amount, date)
         VALUES ($1, $2, 'fuel', $3, $4)`,
        [req.userId, id, data.expenses_fuel, workdayDate],
      );
    }

    if (data.expenses_food > 0) {
      await db.query(
        `INSERT INTO expenses (user_id, workday_id, category, amount, date)
         VALUES ($1, $2, 'food', $3, $4)`,
        [req.userId, id, data.expenses_food, workdayDate],
      );
    }

    if (data.expenses_other > 0) {
      await db.query(
        `INSERT INTO expenses (user_id, workday_id, category, amount, date)
         VALUES ($1, $2, 'other', $3, $4)`,
        [req.userId, id, data.expenses_other, workdayDate],
      );
    }

    res.json({
      ...result.rows[0],
      expenses_fuel: data.expenses_fuel,
      expenses_food: data.expenses_food,
      expenses_other: data.expenses_other,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month } = req.query;

    if (!month || typeof month !== "string") {
      throw new BadRequestError("Informe o mês no formato YYYY-MM");
    }

    const result = await db.query(
      `SELECT 
         w.*,
         (w.earnings_uber + w.earnings_99 + w.earnings_particular) as total_earnings,
         (end_odometer - start_odometer) as km_driven,
         COALESCE(SUM(e.amount), 0) as total_expenses
       FROM workdays w
       LEFT JOIN expenses e ON e.workday_id = w.id
       WHERE w.user_id = $1
         AND w.status = 'finished'
         AND TO_CHAR(w.date, 'YYYY-MM') = $2
       GROUP BY w.id
       ORDER BY w.date DESC`,
      [req.userId, month],
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
