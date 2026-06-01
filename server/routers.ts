import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { indicatorsRouter } from "./routers/indicators";
import { newsEmissionsProcedure } from "./routers/news-emissions";
import { gnewsEmissionsRouter } from "./routers/gnews-emissions";
import { serpapiSearchRouter } from "./routers/serpapi-search";
import { geminiAnalysisRouter } from "./routers/gemini-analysis";
import { opportunitiesRouter } from "./routers/opportunities";
import { newLaunchesRouter } from "./routers/new-launches";
import { anbimaProcedure } from "./routers/anbima-data";
import { comprehensiveSearchProcedure } from "./routers/comprehensive-search";
import { intelligentAnalysisProcedure } from "./routers/intelligent-analysis";
import { smartAlertsProcedure } from "./routers/smart-alerts";
import { smartReportsProcedure } from "./routers/smart-reports";
import { refinancingOpportunitiesRouter } from "./routers/refinancing-opportunities";
import { refinancingAnalysisRouter } from "./routers/refinancing-analysis";
import { criDetailRouter } from "./routers/cri-detail";
import { linkedinContactsRouter } from "./routers/linkedin-contacts";
import { criApprovalRouter } from "./routers/cri-approval";
import { authLocalRouter } from "./routers/auth-local";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  indicators: indicatorsRouter,
  newsEmissions: router({
    get: newsEmissionsProcedure,
  }),
  gnewsEmissions: gnewsEmissionsRouter,
  googleSearch: serpapiSearchRouter,
  gemini: geminiAnalysisRouter,
  opportunities: opportunitiesRouter,
  newLaunches: newLaunchesRouter,
  anbima: router({
    get: anbimaProcedure.get,
  }),
  comprehensiveSearch: router({
    query: comprehensiveSearchProcedure,
  }),
  intelligentAnalysis: router({
    analyze: intelligentAnalysisProcedure,
  }),
  smartAlerts: smartAlertsProcedure,
  smartReports: smartReportsProcedure,
  refinancing: refinancingOpportunitiesRouter,
  refinancingAnalysis: refinancingAnalysisRouter,
  cri: router({ get: criDetailRouter.get }),
  linkedin: linkedinContactsRouter,
  criApproval: criApprovalRouter,
  authLocal: authLocalRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
