import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "../db/client";
import { BadRequestError } from "../middleware/errorHandler";

const router = Router();

/**
 * @swagger
 * /api/insights:
 *   get:
 *     summary: Retorna métricas financeiras do mês
 *     tags: [Insights]
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
 *         description: Métricas calculadas com sucesso
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

    const workdaysResult = await db.query(
      `SELECT
         COUNT(DISTINCT date) as worked_days,
         COALESCE(SUM(earnings_uber + earnings_99 + earnings_particular), 0) as total_earnings,
         COALESCE(SUM(end_odometer - start_odometer), 0) as total_km
       FROM workdays
       WHERE user_id = $1
         AND status = 'finished'
         AND TO_CHAR(date, 'YYYY-MM') = $2`,
      [req.userId, month],
    );

    const expensesResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses
       FROM expenses
       WHERE user_id = $1
         AND TO_CHAR(date, 'YYYY-MM') = $2`,
      [req.userId, month],
    );

    const earningsByAppResult = await db.query(
      `SELECT
         COALESCE(SUM(earnings_uber), 0) as uber,
         COALESCE(SUM(earnings_99), 0) as "99",
         COALESCE(SUM(earnings_particular), 0) as particular
       FROM workdays
       WHERE user_id = $1
         AND status = 'finished'
         AND TO_CHAR(date, 'YYYY-MM') = $2`,
      [req.userId, month],
    );

    const configResult = await db.query(
      `SELECT month_goal, planned_days, min_value_per_km
       FROM journey_configs
       WHERE user_id = $1`,
      [req.userId],
    );

    const w = workdaysResult.rows[0];
    const totalEarnings = parseFloat(w.total_earnings);
    const totalExpenses = parseFloat(expensesResult.rows[0].total_expenses);
    const totalKm = parseFloat(w.total_km);
    const workedDays = parseInt(w.worked_days);
    const netProfit = totalEarnings - totalExpenses;

    const config = configResult.rows[0];
    const monthGoal = config ? parseFloat(config.month_goal) : 0;
    const plannedDays = config ? parseInt(config.planned_days) : 0;

    const averageProfitPerDay = workedDays > 0 ? netProfit / workedDays : 0;
    const averageEarningsPerKm = totalKm > 0 ? totalEarnings / totalKm : 0;

    const [year, monthNum] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const today = new Date().getDate();
    const daysRemainingInMonth = Math.max(daysInMonth - today, 0);

    const minValuePerKm = config ? parseFloat(config.min_value_per_km) : 0;
    const avgKmPerDay = workedDays > 0 ? totalKm / workedDays : 0;
    const estimatedRemainingKm = avgKmPerDay * daysRemainingInMonth;
    const accumulatedDeficit = totalKm * (minValuePerKm - averageEarningsPerKm);
    const correctionPerKm = estimatedRemainingKm > 0 ? Math.max(accumulatedDeficit, 0) / estimatedRemainingKm : 0;
    const suggestedMinPerKm = minValuePerKm + correctionPerKm;

    const apps = earningsByAppResult.rows[0];
    const earningsByApp = [
      { app: "Uber", value: parseFloat(apps.uber) },
      { app: "99", value: parseFloat(apps["99"]) },
      { app: "Particular", value: parseFloat(apps.particular) },
    ];

    res.json({
      totalEarnings,
      totalExpenses,
      netProfit,
      workedDays,
      plannedDays,
      monthGoal,
      averageProfitPerDay,
      averageEarningsPerKm,
      suggestedMinPerKm,
      daysRemainingInMonth,
      totalKm,
      earningsByApp,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
