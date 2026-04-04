import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { getUserProfile, updateUserProfile } from "../services/userService";

const router = Router();

const updateProfileSchema = z.object({
  display_name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatar_url: z.string().url().optional(),
});

router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getUserProfile(req.userId!);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

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
