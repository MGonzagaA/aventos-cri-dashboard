import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { db, users } from "../db/index";
import { getSessionCookieOptions } from "../_core/cookies";

export const LOCAL_COOKIE = "aventos_local_token";
const JWT_SECRET = process.env.JWT_SECRET ?? "aventos-secret";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "gonzaga.cntts@gmail.com";

// ─── Email ────────────────────────────────────────────────────────────────────

async function notifyNewUser(name: string, email: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("[Email] GMAIL_USER / GMAIL_APP_PASSWORD não configurados");
    return;
  }
  try {
    const t = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user, pass },
    });
    await t.sendMail({
      from: `"Aventos CRI Dashboard" <${user}>`,
      to: ADMIN_EMAIL,
      subject: `[Aventos] Novo usuário: ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#16A085">Novo usuário cadastrado</h2>
          <p><b>Nome:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Data:</b> ${new Date().toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</p>
          <hr/>
          <p style="font-size:12px;color:#888">Aventos CRI Dashboard · Grupo Aventos</p>
        </div>`,
    });
    console.log(`[Email] Notificação enviada para ${ADMIN_EMAIL}`);
  } catch (e: any) {
    console.error("[Email] Falha:", e.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { id: number; email: string; name: string; role: string } | null {
  try { return jwt.verify(token, JWT_SECRET) as any; } catch { return null; }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const authLocalRouter = router({

  register: publicProcedure
    .input(z.object({
      name:     z.string().min(2, "Nome muito curto"),
      email:    z.string().email("Email inválido"),
      password: z.string().min(6, "Senha mínima: 6 caracteres"),
    }))
    .mutation(async ({ input }) => {
      if (!db) throw new Error("Banco não configurado");

      const existing = await db.select({ id: users.id })
        .from(users).where(eq(users.email, input.email)).limit(1);
      if (existing.length > 0) throw new Error("Email já cadastrado");

      const passwordHash = await bcrypt.hash(input.password, 12);
      const openId = `local:${input.email}`;
      const role = input.email === ADMIN_EMAIL ? "admin" : "user";

      await db.insert(users).values({
        openId, name: input.name, email: input.email,
        passwordHash, loginMethod: "email", role, status: "active",
      }).onConflictDoNothing();

      notifyNewUser(input.name, input.email).catch(() => {});
      return { success: true };
    }),

  login: publicProcedure
    .input(z.object({
      email:    z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      let authUser: { id: number; email: string; name: string; role: string } | null = null;

      // ── Fallback: admin hardcoded quando DB indisponível ──────────────────
      const adminEmail = process.env.ADMIN_EMAIL    ?? "gonzaga.cntts@gmail.com";
      const adminPass  = process.env.ADMIN_PASSWORD ?? "1234";

      if (!db || !(await db.select({ id: users.id }).from(users).limit(1).then(() => true).catch(() => false))) {
        if (input.email === adminEmail && input.password === adminPass) {
          authUser = { id: 0, email: adminEmail, name: "Matheus Gonzaga", role: "admin" };
        } else {
          throw new Error("Email ou senha incorretos");
        }
      } else {
        // ── Autenticação via banco ─────────────────────────────────────────
        const rows = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        const user = rows[0];

        if (!user?.passwordHash) throw new Error("Email ou senha incorretos");
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) throw new Error("Email ou senha incorretos");
        if (user.status === "inactive") throw new Error("Usuário inativo. Contate o administrador.");

        await db.update(users)
          .set({ lastSignedIn: new Date(), updatedAt: new Date() })
          .where(eq(users.id, user.id)).catch(() => {});

        authUser = { id: user.id, email: user.email ?? "", name: user.name ?? "", role: user.role };
      }

      if (!authUser) throw new Error("Email ou senha incorretos");

      const token = signToken(authUser);
      const opts  = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(LOCAL_COOKIE, token, { ...opts, maxAge: 7 * 24 * 60 * 60 * 1000 });

      return { success: true, user: authUser };
    }),

  me: publicProcedure.query(({ ctx }) => {
    const token = ctx.req.cookies?.[LOCAL_COOKIE];
    return token ? verifyToken(token) : null;
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(LOCAL_COOKIE, { ...opts, maxAge: -1 });
    return { success: true };
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────

  listUsers: publicProcedure.query(async ({ ctx }) => {
    const token = ctx.req.cookies?.[LOCAL_COOKIE];
    const user  = token ? verifyToken(token) : null;
    if (user?.role !== "admin") throw new Error("Acesso negado");
    if (!db) return [];

    return db.select({
      id: users.id, name: users.name, email: users.email,
      role: users.role, status: users.status,
      createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
    }).from(users).orderBy(desc(users.createdAt));
  }),

  updateUser: publicProcedure
    .input(z.object({
      userId: z.number(),
      role:   z.enum(["user", "admin"]).optional(),
      status: z.enum(["active", "inactive", "pending"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = ctx.req.cookies?.[LOCAL_COOKIE];
      const admin = token ? verifyToken(token) : null;
      if (admin?.role !== "admin") throw new Error("Acesso negado");
      if (!db) throw new Error("Banco não configurado");

      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.role)   set.role   = input.role;
      if (input.status) set.status = input.status;

      await db.update(users).set(set).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
