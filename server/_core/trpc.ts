import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const FIELD_LABELS: Record<string, string> = {
  name: "Nome", email: "Email", password: "Senha",
};

function friendlyZodMessage(issues: any[]): string {
  if (!issues?.length) return "Dados inválidos";
  const issue = issues[0];
  const field = FIELD_LABELS[String(issue.path?.[0])] ?? String(issue.path?.[0] ?? "Campo");
  switch (issue.code) {
    case "invalid_format":
      return issue.format === "email" ? "Email inválido" : `${field}: formato inválido`;
    case "too_small":
      return `${field} muito curto (mínimo ${issue.minimum} caracteres)`;
    case "too_big":
      return `${field} muito longo (máximo ${issue.maximum} caracteres)`;
    default:
      return issue.message ?? "Dados inválidos";
  }
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Zod v4 serializa ZodError.message como JSON array de issues
    if (error.code === "BAD_REQUEST") {
      try {
        const issues = JSON.parse(error.message);
        if (Array.isArray(issues)) {
          return { ...shape, message: friendlyZodMessage(issues) };
        }
      } catch { /* mensagem já é texto normal */ }
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
