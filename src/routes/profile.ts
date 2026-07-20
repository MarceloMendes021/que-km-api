import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { getUserProfile, updateUserProfile } from "../services/userService";

const router = Router();

const updateProfileSchema = z.object({
  display_name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  avatar_url: z.string().url().optional(),
});

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Retorna o perfil do usuário autenticado
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil encontrado
 *       401:
 *         description: Não autorizado
 */
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getUserProfile(req.userId!);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/profile:
 *   patch:
 *     summary: Atualiza o perfil do usuário
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *                 example: Marcelo Mendes
 *               phone:
 *                 type: string
 *                 example: 41999999999
 *               avatar_url:
 *                 type: string
 *                 example: https://exemplo.com/foto.jpg
 *     responses:
 *       200:
 *         description: Perfil atualizado
 *       401:
 *         description: Não autorizado
 */
router.patch("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const profile = await updateUserProfile(req.userId!, data);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

export default router;
