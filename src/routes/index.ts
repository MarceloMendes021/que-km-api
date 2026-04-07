import { Router } from "express";
import profileRouter from "./profile";
import journeyConfigRouter from "./journeyConfig";
import workdaysRouter from "./workdays";
import expensesRouter from "./expenses";
import insightsRouter from "./insights";
import webhooksRouter from "./webhooks";

const router = Router();

router.use("/profile", profileRouter);
router.use("/journey-config", journeyConfigRouter);
router.use("/workdays", workdaysRouter);
router.use("/expenses", expensesRouter);
router.use("/insights", insightsRouter);

export { router as apiRouter, webhooksRouter };
