import express from "express";
import cors from "cors";
import { apiRouter, webhooksRouter } from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

const app = express();

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  }),
);

app.use("/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", project: "que-km-api" });
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/webhooks", webhooksRouter);
app.use("/api", apiRouter);

app.use(errorHandler);

export default app;
