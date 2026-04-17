import { db } from "../db/client";
import { NotFoundError } from "../middleware/errorHandler";

export interface UserProfile {
  id: string;
  clerk_id: string;
  display_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: Date;
}

export async function findOrCreateUser(clerkId: string, displayName: string, email: string): Promise<UserProfile> {
  const existing = await db.query<UserProfile>("SELECT * FROM users WHERE clerk_id = $1", [clerkId]);

  if (existing.rows[0]) return existing.rows[0];

  const created = await db.query<UserProfile>(
    `INSERT INTO users (clerk_id, display_name, email)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [clerkId, displayName, email],
  );

  return created.rows[0];
}

export async function getUserProfile(clerkId: string): Promise<UserProfile> {
  const result = await db.query<UserProfile>("SELECT * FROM users WHERE id = $1", [clerkId]);

  if (!result.rows[0]) {
    throw new NotFoundError("Usuário não encontrado");
  }

  return result.rows[0];
}

export async function updateUserProfile(clerkId: string, data: Partial<Pick<UserProfile, "display_name" | "phone" | "avatar_url">>): Promise<UserProfile> {
  try {
    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) {
      throw new NotFoundError("Nenhum campo para atualizar");
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(", ");

    const result = await db.query<UserProfile>(
      `UPDATE users SET ${setClause}, updated_at = NOW()
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, clerkId],
    );

    if (!result.rows[0]) {
      throw new NotFoundError("Usuário não encontrado");
    }

    return result.rows[0];
  } catch (error) {
    console.log("Update error:", error);
    throw error;
  }
}
