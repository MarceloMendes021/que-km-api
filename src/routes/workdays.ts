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

/**
 * @swagger
 * /api/workdays:
 *   post:
 *     summary: Inicia uma nova jornada
 *     tags: [Workdays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_odometer]
 *             properties:
 *               start_odometer:
 *                 type: number
 *                 example: 45230
 *     responses:
 *       201:
 *         description: Jornada iniciada
 *       400:
 *         description: Já existe uma jornada ativa
 *       401:
 *         description: Não autorizado
 */
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

/**
 * @swagger
 * /api/workdays/active:
 *   get:
 *     summary: Retorna a jornada ativa do usuário
 *     tags: [Workdays]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jornada ativa ou null
 *       401:
 *         description: Não autorizado
 */
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

/**
 * @swagger
 * /api/workdays/{id}/finish:
 *   patch:
 *     summary: Encerra a jornada com ganhos e despesas
 *     tags: [Workdays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [end_odometer]
 *             properties:
 *               end_odometer:
 *                 type: number
 *                 example: 45530
 *               earnings_uber:
 *                 type: number
 *                 example: 150.00
 *               earnings_99:
 *                 type: number
 *                 example: 80.00
 *               earnings_particular:
 *                 type: number
 *                 example: 0
 *               expenses_fuel:
 *                 type: number
 *                 example: 60.00
 *               expenses_food:
 *                 type: number
 *                 example: 20.00
 *               expenses_other:
 *                 type: number
 *                 example: 0
 *     responses:
 *       200:
 *         description: Jornada encerrada
 *       400:
 *         description: KM final menor que KM inicial
 *       404:
 *         description: Jornada não encontrada
 *       401:
 *         description: Não autorizado
 */
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

/**
 * @swagger
 * /api/workdays:
 *   get:
 *     summary: Lista jornadas finalizadas do mês
 *     tags: [Workdays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           example: 2026-07
 *         description: Mês no formato YYYY-MM
 *     responses:
 *       200:
 *         description: Lista de jornadas
 *       400:
 *         description: Mês não informado
 *       401:
 *         description: Não autorizado
 */
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

/**
 * @swagger
 * /api/workdays/{id}:
 *   delete:
 *     summary: Remove uma jornada e suas despesas
 *     tags: [Workdays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Jornada removida
 *       404:
 *         description: Jornada não encontrada
 *       401:
 *         description: Não autorizado
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const workday = await db.query(`SELECT id FROM workdays WHERE id = $1 AND user_id = $2`, [id, req.userId]);

    if (!workday.rows[0]) {
      return res.status(404).json({ error: "Jornada não encontrada" });
    }

    await db.query(`DELETE FROM expenses WHERE workday_id = $1`, [id]);

    await db.query(`DELETE FROM workdays WHERE id = $1`, [id]);

    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

const updateWorkdaySchema = z.object({
  earnings_uber: z.number().min(0).optional(),
  earnings_99: z.number().min(0).optional(),
  earnings_particular: z.number().min(0).optional(),
  expenses_fuel: z.number().min(0).optional(),
  expenses_food: z.number().min(0).optional(),
  expenses_other: z.number().min(0).optional(),
});

/**
 * @swagger
 * /api/workdays/{id}:
 *   patch:
 *     summary: Atualiza ganhos e despesas de uma jornada finalizada
 *     tags: [Workdays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               earnings_uber:
 *                 type: number
 *               earnings_99:
 *                 type: number
 *               earnings_particular:
 *                 type: number
 *               expenses_fuel:
 *                 type: number
 *               expenses_food:
 *                 type: number
 *               expenses_other:
 *                 type: number
 *     responses:
 *       200:
 *         description: Jornada atualizada
 *       404:
 *         description: Jornada não encontrada
 *       401:
 *         description: Não autorizado
 */
router.patch("/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = updateWorkdaySchema.parse(req.body);

    const workday = await db.query(`SELECT id FROM workdays WHERE id = $1 AND user_id = $2 AND status = 'finished'`, [id, req.userId]);

    if (!workday.rows[0]) {
      throw new NotFoundError("Jornada não encontrada");
    }

    const result = await db.query(
      `UPDATE workdays SET
         earnings_uber = COALESCE($1, earnings_uber),
         earnings_99 = COALESCE($2, earnings_99),
         earnings_particular = COALESCE($3, earnings_particular),
         updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [data.earnings_uber, data.earnings_99, data.earnings_particular, id, req.userId],
    );

    if (data.expenses_fuel !== undefined) {
      await db.query(`DELETE FROM expenses WHERE workday_id = $1 AND category = 'fuel'`, [id]);
      await db.query(
        `INSERT INTO expenses (user_id, workday_id, category, amount, date)
     VALUES ($1, $2, 'fuel', $3, (SELECT date FROM workdays WHERE id = $2))`,
        [req.userId, id, data.expenses_fuel],
      );
    }

    if (data.expenses_food !== undefined) {
      await db.query(`DELETE FROM expenses WHERE workday_id = $1 AND category = 'food'`, [id]);
      await db.query(
        `INSERT INTO expenses (user_id, workday_id, category, amount, date)
     VALUES ($1, $2, 'food', $3, (SELECT date FROM workdays WHERE id = $2))`,
        [req.userId, id, data.expenses_food],
      );
    }

    if (data.expenses_other !== undefined) {
      await db.query(`DELETE FROM expenses WHERE workday_id = $1 AND category = 'other'`, [id]);
      await db.query(
        `INSERT INTO expenses (user_id, workday_id, category, amount, date)
     VALUES ($1, $2, 'other', $3, (SELECT date FROM workdays WHERE id = $2))`,
        [req.userId, id, data.expenses_other],
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
