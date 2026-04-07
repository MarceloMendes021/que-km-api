import { Router, Request, Response } from "express";
import { Webhook } from "svix";
import { findOrCreateUser } from "../services/userService";

const router = Router();

router.post("/clerk", async (req: Request, res: Response) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    res.status(500).json({ error: "Webhook secret não configurado" });
    return;
  }

  const svixId = req.headers["svix-id"] as string;
  const svixTimestamp = req.headers["svix-timestamp"] as string;
  const svixSignature = req.headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: "Headers do svix ausentes" });
    return;
  }

  try {
    const wh = new Webhook(secret);
    const payload = wh.verify(JSON.stringify(req.body), {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as any;

    if (payload.type === "user.created") {
      const { id, first_name, last_name, email_addresses } = payload.data;
      const displayName = `${first_name ?? ""} ${last_name ?? ""}`.trim() || "Usuário";
      const email = email_addresses?.[0]?.email_address ?? "";

      await findOrCreateUser(id, displayName, email);
    }

    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: "Assinatura inválida" });
  }
});

export default router;
