import type { FastifyInstance } from "fastify";
import { getCategories } from "./get-categories";
import { createCategory } from "./create-category";
import { updateCategory } from "./update-category";
import { deleteCategory } from "./delete-category";

export async function categoryRoutes(app: FastifyInstance) {
  await app.register(getCategories);
  await app.register(createCategory);
  await app.register(updateCategory);
  await app.register(deleteCategory);
}