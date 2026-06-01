import { eq } from "drizzle-orm";
import { db, users, type InsertUser } from "./db/index";
import { ENV } from "./_core/env";

export { db };
export type { InsertUser };

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  try {
    await db
      .insert(users)
      .values({
        openId:       user.openId,
        name:         user.name         ?? null,
        email:        user.email        ?? null,
        loginMethod:  user.loginMethod  ?? null,
        role:         user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user"),
        lastSignedIn: user.lastSignedIn ?? new Date(),
      })
      .onConflictDoUpdate({
        target: users.openId,
        set: {
          name:         user.name        ?? null,
          email:        user.email       ?? null,
          loginMethod:  user.loginMethod ?? null,
          lastSignedIn: new Date(),
          updatedAt:    new Date(),
        },
      });
  } catch (error) {
    console.error("[DB] upsertUser falhou:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);
    return result[0] ?? undefined;
  } catch (error) {
    console.error("[DB] getUserByOpenId falhou:", error);
    return undefined;
  }
}
