import type { FastifyInstance } from "fastify";
import { createProduct } from "./create-product";
import { updateProduct } from "./update-product";
import { getProducts } from "./get-products";
import { getProduct } from "./get-product";
import { deleteProduct } from "./delete-product";

export async function productRoutes(app: FastifyInstance) {
  await app.register(createProduct);
  await app.register(updateProduct);
  await app.register(getProducts);
  await app.register(getProduct);
  await app.register(deleteProduct);
}

