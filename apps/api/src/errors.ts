import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { HttpError } from "./http-error";

export type ApiErrorBody = {
  code: string;
  message: string;
};

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ code: "NOT_FOUND", message: "Маршрут не найден" } satisfies ApiErrorBody);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.status).send({ code: error.code, message: error.message } satisfies ApiErrorBody);
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({ code: "VALIDATION", message: "Некорректный запрос" } satisfies ApiErrorBody);
      return;
    }

    request.log.error(error);
    reply.status(500).send({ code: "INTERNAL", message: "Внутренняя ошибка" } satisfies ApiErrorBody);
  });
}
