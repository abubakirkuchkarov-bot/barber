import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { loadAnalytics, readPeriod } from "../analytics/query";

export function registerAnalytics(app: FastifyInstance, guard: { preHandler: preHandlerHookHandler }) {
  app.get("/admin/analytics/revenue", guard, async (request) => {
    const period = await readPeriod(request.query);
    const report = await loadAnalytics(period);
    return { from: period.from, to: period.to, ...report.revenue };
  });

  app.get("/admin/analytics/services", guard, async (request) => {
    const period = await readPeriod(request.query);
    const report = await loadAnalytics(period);
    return { from: period.from, to: period.to, services: report.services };
  });

  app.get("/admin/analytics/load", guard, async (request) => {
    const period = await readPeriod(request.query);
    const report = await loadAnalytics(period);
    return { from: period.from, to: period.to, barbers: report.load };
  });

  app.get("/admin/analytics/heatmap", guard, async (request) => {
    const period = await readPeriod(request.query);
    const report = await loadAnalytics(period);
    return { from: period.from, to: period.to, ...report.heatmap };
  });

  app.get("/admin/analytics/cancellations", guard, async (request) => {
    const period = await readPeriod(request.query);
    const report = await loadAnalytics(period);
    return { from: period.from, to: period.to, ...report.cancellations };
  });

  app.get("/admin/analytics/retention", guard, async (request) => {
    const period = await readPeriod(request.query);
    const report = await loadAnalytics(period);
    return { from: period.from, to: period.to, ...report.retention };
  });
}
