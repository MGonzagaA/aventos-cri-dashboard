import { publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { notifyOwner } from "../_core/notification";

interface Alert {
  id: string;
  type: "new-emission" | "rate-drop" | "maturity-warning" | "opportunity";
  criName: string;
  message: string;
  severity: "low" | "medium" | "high";
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

let activeAlerts: Alert[] = [];

export const smartAlertsProcedure = {
  // Listar alertas
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["all", "unread"]).optional(),
        type: z
          .enum(["new-emission", "rate-drop", "maturity-warning", "opportunity"])
          .optional(),
      })
    )
    .query(({ input }) => {
      let filtered = [...activeAlerts];

      if (input.status === "unread") {
        filtered = filtered.filter((a) => !a.read);
      }

      if (input.type) {
        filtered = filtered.filter((a) => a.type === input.type);
      }

      return {
        alerts: filtered.sort((a, b) => b.timestamp - a.timestamp),
        unreadCount: filtered.filter((a) => !a.read).length,
      };
    }),

  // Marcar como lido
  markAsRead: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(({ input }) => {
      const alert = activeAlerts.find((a) => a.id === input.alertId);
      if (alert) {
        alert.read = true;
      }
      return { success: true };
    }),

  // Criar alerta de nova emissão
  createNewEmissionAlert: publicProcedure
    .input(
      z.object({
        criName: z.string(),
        securitizer: z.string(),
        rate: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const alert: Alert = {
        id: `alert-${Date.now()}`,
        type: "new-emission",
        criName: input.criName,
        message: `Nova emissão de CRI: ${input.criName} por ${input.securitizer} com taxa ${input.rate}`,
        severity: "high",
        timestamp: Date.now(),
        read: false,
        actionUrl: `/cri/${input.criName}`,
      };

      activeAlerts.push(alert);

      // Notificar owner
      await notifyOwner({
        title: `🚀 Nova Emissão de CRI: ${input.criName}`,
        content: `${input.securitizer} lançou ${input.criName} com taxa ${input.rate}`,
      });

      console.log("[Smart Alerts] Nova emissão alertada:", input.criName);

      return { alert };
    }),

  // Criar alerta de queda de taxa
  createRateDropAlert: publicProcedure
    .input(
      z.object({
        criName: z.string(),
        oldRate: z.number(),
        newRate: z.number(),
        dropPercentage: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const alert: Alert = {
        id: `alert-${Date.now()}`,
        type: "rate-drop",
        criName: input.criName,
        message: `Taxa caiu ${input.dropPercentage.toFixed(2)}% em ${input.criName}: ${input.oldRate.toFixed(2)}% → ${input.newRate.toFixed(2)}%`,
        severity: input.dropPercentage > 2 ? "high" : "medium",
        timestamp: Date.now(),
        read: false,
      };

      activeAlerts.push(alert);

      // Notificar owner se queda significativa
      if (input.dropPercentage > 2) {
        await notifyOwner({
          title: `⚠️ Queda Significativa de Taxa: ${input.criName}`,
          content: `Taxa caiu ${input.dropPercentage.toFixed(2)}% - Possível oportunidade de refinanciamento`,
        });
      }

      console.log("[Smart Alerts] Queda de taxa alertada:", input.criName);

      return { alert };
    }),

  // Criar alerta de vencimento próximo
  createMaturityAlert: publicProcedure
    .input(
      z.object({
        criName: z.string(),
        maturityDate: z.string(),
        daysUntilMaturity: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const alert: Alert = {
        id: `alert-${Date.now()}`,
        type: "maturity-warning",
        criName: input.criName,
        message: `${input.criName} vence em ${input.daysUntilMaturity} dias (${input.maturityDate})`,
        severity:
          input.daysUntilMaturity < 30
            ? "high"
            : input.daysUntilMaturity < 60
              ? "medium"
              : "low",
        timestamp: Date.now(),
        read: false,
      };

      activeAlerts.push(alert);

      // Notificar owner se vencimento próximo
      if (input.daysUntilMaturity < 30) {
        await notifyOwner({
          title: `⏰ Vencimento Próximo: ${input.criName}`,
          content: `${input.criName} vence em ${input.daysUntilMaturity} dias. Considere refinanciamento.`,
        });
      }

      console.log("[Smart Alerts] Vencimento alertado:", input.criName);

      return { alert };
    }),

  // Criar alerta de oportunidade
  createOpportunityAlert: publicProcedure
    .input(
      z.object({
        criName: z.string(),
        reason: z.string(),
        opportunityScore: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const alert: Alert = {
        id: `alert-${Date.now()}`,
        type: "opportunity",
        criName: input.criName,
        message: `Oportunidade identificada em ${input.criName}: ${input.reason} (Score: ${input.opportunityScore}/100)`,
        severity: input.opportunityScore > 80 ? "high" : "medium",
        timestamp: Date.now(),
        read: false,
      };

      activeAlerts.push(alert);

      // Notificar owner se oportunidade alta
      if (input.opportunityScore > 80) {
        await notifyOwner({
          title: `💡 Oportunidade de Alto Potencial: ${input.criName}`,
          content: `${input.reason} - Score de oportunidade: ${input.opportunityScore}/100`,
        });
      }

      console.log(
        "[Smart Alerts] Oportunidade alertada:",
        input.criName,
        input.opportunityScore
      );

      return { alert };
    }),

  // Limpar alertas antigos (mais de 30 dias)
  cleanup: publicProcedure.mutation(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const before = activeAlerts.length;
    activeAlerts = activeAlerts.filter((a) => a.timestamp > thirtyDaysAgo);
    const after = activeAlerts.length;

    console.log(
      `[Smart Alerts] Limpeza: removidos ${before - after} alertas antigos`
    );

    return {
      removed: before - after,
      remaining: after,
    };
  }),
};
