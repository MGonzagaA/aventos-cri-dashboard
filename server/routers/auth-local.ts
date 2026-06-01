import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { supabase } from "../db/index";
import { getSessionCookieOptions } from "../_core/cookies";

export const LOCAL_COOKIE = "aventos_local_token";
const JWT_SECRET  = process.env.JWT_SECRET   ?? "aventos-secret";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL  ?? "gonzaga.cntts@gmail.com";
const ADMIN_PASS  = process.env.ADMIN_PASSWORD ?? "1234";

// ─── Email ────────────────────────────────────────────────────────────────────

async function notifyNewUser(name: string, email: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return;
  try {
    const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, secure: false, auth: { user, pass } });
    await t.sendMail({
      from: `"Aventos CRI Dashboard" <${user}>`,
      to: ADMIN_EMAIL,
      subject: `[Aventos] Novo usuário: ${name}`,
      html: `<h2>Novo usuário</h2><p><b>Nome:</b> ${name}</p><p><b>Email:</b> ${email}</p>`,
    });
  } catch (e: any) { console.error("[Email]", e.message); }
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { id: number; email: string; name: string; role: string } | null {
  try { return jwt.verify(token, JWT_SECRET) as any; } catch { return null; }
}

// ─── Supabase REST helpers ────────────────────────────────────────────────────

async function findUserByEmail(email: string) {
  if (!supabase) return null;
  const { data } = await supabase.from("users").select("*").eq("email", email).limit(1).single();
  return data ?? null;
}

async function createUser(payload: Record<string, unknown>) {
  if (!supabase) throw new Error("Banco não configurado");
  const { error } = await supabase.from("users").upsert(payload, { onConflict: "open_id" });
  if (error) throw new Error(error.message);
}

async function updateUserLastSeen(id: number) {
  if (!supabase) return;
  await supabase.from("users").update({ last_signed_in: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const authLocalRouter = router({

  register: publicProcedure
    .input(z.object({
      name:     z.string().min(2),
      email:    z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      if (!supabase) throw new Error("Banco não configurado");

      const existing = await findUserByEmail(input.email);
      if (existing) throw new Error("Email já cadastrado");

      const passwordHash = await bcrypt.hash(input.password, 12);
      const role = input.email === ADMIN_EMAIL ? "admin" : "user";

      await createUser({
        open_id: `local:${input.email}`,
        name: input.name,
        email: input.email,
        password_hash: passwordHash,
        login_method: "email",
        role,
        status: "active",
      });

      notifyNewUser(input.name, input.email).catch(() => {});
      return { success: true };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      let authUser: { id: number; email: string; name: string; role: string } | null = null;

      // ── Tentar via Supabase REST ──────────────────────────────────────────
      if (supabase) {
        const user = await findUserByEmail(input.email);

        if (user?.password_hash) {
          const valid = await bcrypt.compare(input.password, user.password_hash);
          if (!valid) throw new Error("Email ou senha incorretos");
          if (user.status === "inactive") throw new Error("Usuário inativo. Contate o administrador.");
          updateUserLastSeen(user.id).catch(() => {});
          authUser = { id: user.id, email: user.email, name: user.name ?? "", role: user.role };

        // ── Fallback admin hardcoded (tabela ainda não inicializada ou admin não semeado)
        } else if (input.email === ADMIN_EMAIL && input.password === ADMIN_PASS) {
          authUser = { id: 0, email: ADMIN_EMAIL, name: "Matheus Gonzaga", role: "admin" };
        } else {
          throw new Error("Email ou senha incorretos");
        }

      // ── Fallback hardcoded quando sem banco ───────────────────────────────
      } else {
        if (input.email === ADMIN_EMAIL && input.password === ADMIN_PASS) {
          authUser = { id: 0, email: ADMIN_EMAIL, name: "Matheus Gonzaga", role: "admin" };
        } else {
          throw new Error("Email ou senha incorretos");
        }
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

  listUsers: publicProcedure.query(async ({ ctx }) => {
    const token = ctx.req.cookies?.[LOCAL_COOKIE];
    const me    = token ? verifyToken(token) : null;
    if (me?.role !== "admin") throw new Error("Acesso negado");
    if (!supabase) return [];

    const { data } = await supabase
      .from("users")
      .select("id, name, email, role, status, created_at, last_signed_in")
      .order("created_at", { ascending: false });
    return (data ?? []).map(u => ({
      ...u,
      createdAt:    u.created_at,
      lastSignedIn: u.last_signed_in,
    }));
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
      if (!supabase) throw new Error("Banco não configurado");

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.role)   patch.role   = input.role;
      if (input.status) patch.status = input.status;

      await supabase.from("users").update(patch).eq("id", input.userId);
      return { success: true };
    }),
});
