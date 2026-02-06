import type { FastifyInstance } from "fastify";
import { createRecurrence } from "./create-recurrence";
import { deleteRecurrence } from "./delete-recurrence";
import { updateRecurrence } from "./update-recurrence";
import { toggleRecurrenceStatus } from "./toggle-recurrence-status";
import { getRecurrences } from "./get-recurrences";

export async function recurrencesRoutes(app: FastifyInstance) {
  await app.register(createRecurrence);
  await app.register(deleteRecurrence);
  await app.register(updateRecurrence);
  await app.register(toggleRecurrenceStatus);
  await app.register(getRecurrences);
}