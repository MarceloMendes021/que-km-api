import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";

const router = Router();

const journeyConfigSchema = z.object({
  car_model: z.string().nullable().optional(),
  fuel_type: z.enum(["gasolina", "etanol", "flex", "gnv", "diesel"]).nullable().optional(),
  avg_consumption: z
    .union([z.number(), z.string().transform(Number)])
    .nullable()
    .optional(),
  month_goal: z.number().min(0).nullable().optional(),
  planned_days: z.number().min(1).max(31).nullable().optional(),
  min_value_per_km: z
    .union([z.number(), z.string().transform(Number)])
    .nullable()
    .optional(),
});

/**
 * @swagger
 * /api/journey-config:
 *   get:
 *     summary: Retorna a configuração de veículo e metas do usuário
 *     tags: [Journey Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuração encontrada
 *       401:
 *         description: Não autorizado
 */
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query("SELECT * FROM journey_configs WHERE user_id = $1", [req.userId]);

    if (!result.rows[0]) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/journey-config:
 *   put:
 *     summary: Atualiza as configuração de veículo e metas do usuário
 *     tags: [Journey Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               car_model:
 *                 type: string
 *                 example: Onix 1.0 2022
 *               fuel_type:
 *                 type: string
 *                 enum: [gasolina, etanol, flex, gnv, diesel]
 *               avg_consumption:
 *                 type: number
 *                 example: 10
 *               month_goal:
 *                 type: number
 *                 example: 3000
 *               planned_days:
 *                 type: number
 *                 example: 22
 *               min_value_per_km:
 *                 type: number
 *                 example: 1.30
 *     responses:
 *       200:
 *         description: Configuração atualizada
 *       401:
 *         description: Não autorizado
 */
router.put("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = journeyConfigSchema.parse(req.body);

    const result = await db.query(
      `INSERT INTO journey_configs (user_id, car_model, fuel_type, avg_consumption, month_goal, planned_days, min_value_per_km)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id)
       DO UPDATE SET
         car_model = EXCLUDED.car_model,
         fuel_type = EXCLUDED.fuel_type,
         avg_consumption = EXCLUDED.avg_consumption,
         month_goal = EXCLUDED.month_goal,
         planned_days = EXCLUDED.planned_days,
         min_value_per_km = EXCLUDED.min_value_per_km,
         updated_at = NOW()
       RETURNING *`,
      [req.userId, data.car_model, data.fuel_type, data.avg_consumption, data.month_goal, data.planned_days, data.min_value_per_km],
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
