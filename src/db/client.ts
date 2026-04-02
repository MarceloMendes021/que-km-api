import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.connect()
  .then(() => console.log("✅ Banco de dados conectado"))
  .catch((err) => console.error("❌ Erro ao conectar:", err));
