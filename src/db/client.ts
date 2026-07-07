import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

db.on("error", (err: Error) => {
  console.error("❌ Erro inesperado no banco de dados:", err);
});

db.query("SELECT 1")
  .then(() => console.log("✅ Banco de dados conectado"))
  .catch((err: Error) => console.error("❌ Erro ao conectar:", err));
