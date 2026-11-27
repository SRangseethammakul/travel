import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { mockUser } from "./auth/middleware.js";
import { sessionUser } from "./auth/session.js";
import type { Config } from "./config.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { requestLogger } from "./utils/logger.js";
import { healthRoutes } from "./routes/health.routes.js";
import { requireMember, requireUser } from "./auth/middleware.js";
import { devRoutes } from "./routes/dev.routes.js";
import { inviteRoutes } from "./routes/invite.routes.js";
import { joinRoutes } from "./routes/join.routes.js";
import { meRoutes } from "./routes/me.routes.js";
import { memberRoutes } from "./routes/member.routes.js";
import { tripRoutes } from "./routes/trip.routes.js";
import { areaRoutes, placeRoutes } from "./routes/place.routes.js";
import { planRoutes } from "./routes/plan.routes.js";
import { myTagRoutes, tripTagRoutes } from "./routes/tag.routes.js";
import { activityRoutes, balanceRoutes, expenseRoutes, settlementRoutes, summaryRoutes } from "./routes/money.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { checklistRoutes, checklistSuggestionRoutes } from "./routes/checklist.routes.js";
import { documentRoutes, fileRoutes } from "./routes/document.routes.js";
import { personalExpenseRoutes } from "./routes/personal-expense.routes.js";
import { initFileStore } from "./storage/files.js";

/**
 * Builds the app without listening, so supertest can use it. Expects connectDb() to have run.
 *
 * Mounting convention for trip resources: every `/api/trips/:tripId/<resource>` router is
 * mounted with `requireUser, requireMember` here, and adds `requireRole(...)` per write route.
 * Controllers read the trip from `currentMember(req).tripId`.
 */
export function createApp(config: Config) {
  const common = { urlSecret: config.FILE_URL_SECRET, publicApiUrl: config.PUBLIC_API_URL };
  initFileStore(
    config.STORAGE_DRIVER === "s3"
      ? {
          ...common,
          driver: "s3",
          // loadConfig guarantees these when STORAGE_DRIVER=s3
          endpoint: config.S3_ENDPOINT!,
          region: config.S3_REGION,
          bucket: config.S3_BUCKET!,
          accessKeyId: config.S3_ACCESS_KEY_ID!,
          secretAccessKey: config.S3_SECRET_ACCESS_KEY!,
        }
      : { ...common, driver: "local", dir: config.UPLOAD_DIR },
  );
  const app = express();
  app.disable("x-powered-by");
  if (config.TRUST_PROXY > 0) app.set("trust proxy", config.TRUST_PROXY);
  // Signed file URLs are opened from the frontend origin (same site, other port).
  app.use(requestLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser(config.SESSION_SECRET));
  app.use(sessionUser);
  if (config.NODE_ENV !== "production") app.use(mockUser(config.NODE_ENV));

  app.use("/api/health", healthRoutes);
  app.use("/api/me", meRoutes);
  app.use("/api/trips", tripRoutes);
  app.use("/api/trips/:tripId/members", requireUser, requireMember, memberRoutes);
  app.use("/api/trips/:tripId/invite", requireUser, requireMember, inviteRoutes);
  app.use("/api/trips/:tripId/places", requireUser, requireMember, placeRoutes);
  app.use("/api/trips/:tripId/areas", requireUser, requireMember, areaRoutes);
  app.use("/api/trips/:tripId/tags", requireUser, requireMember, tripTagRoutes);
  app.use("/api/trips/:tripId/plan", requireUser, requireMember, planRoutes);
  app.use("/api/me/tags", requireUser, myTagRoutes);
  app.use("/api/trips/:tripId/expenses", requireUser, requireMember, expenseRoutes);
  app.use("/api/trips/:tripId/personal-expenses", requireUser, requireMember, personalExpenseRoutes);
  app.use("/api/trips/:tripId/settlements", requireUser, requireMember, settlementRoutes);
  app.use("/api/trips/:tripId/balances", requireUser, requireMember, balanceRoutes);
  app.use("/api/trips/:tripId/summary", requireUser, requireMember, summaryRoutes);
  app.use("/api/trips/:tripId/activity", requireUser, requireMember, activityRoutes);
  app.use("/api/join", joinRoutes);
  if (config.NODE_ENV !== "production") app.use("/api/dev", devRoutes);
  app.use("/api/trips/:tripId/checklist", requireUser, requireMember, checklistRoutes);
  app.use("/api/checklist", checklistSuggestionRoutes);
  app.use("/api/trips/:tripId/documents", requireUser, requireMember, documentRoutes);
  app.use("/api/files", fileRoutes);
  app.use("/api/auth", authRoutes(config));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
