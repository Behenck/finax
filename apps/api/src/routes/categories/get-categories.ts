import { prisma } from "@/lib/prisma";
import { auth } from "@/middleware/auth";
import { buildCategoryTree } from "@/utils/build-category-tree";
import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { TransactionType } from "generated/prisma/enums";
import z from "zod";
import { BadRequestError } from "../_errors/bad-request-error";

const CategoryBaseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(TransactionType),
  color: z.string(),
  icon: z.string(),
  parentId: z.uuid().nullable(),
});

type Category = z.infer<typeof CategoryBaseSchema> & {
  children: Category[];
};

const CategoryTreeSchema: z.ZodType<Category> = CategoryBaseSchema.extend({
  children: z.array(z.lazy(() => CategoryTreeSchema)),
});

export async function getCategories(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      "/organizations/:slug/categories",
      {
        schema: {
          tags: ["categories"],
          summary: "Get all categories",
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              categories: z.array(CategoryBaseSchema),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new BadRequestError("Organization not found")
        }

        const flatCategories = await prisma.category.findMany({
          select: {
            id: true,
            name: true,
            parentId: true,
            color: true,
            icon: true,
            type: true,
          },
          where: {
            OR: [
              { organizationId: null },
              { organizationId: organization.id },
            ],
          },
          orderBy: {
            name: "asc",
          },
        })

        const categories = buildCategoryTree(flatCategories)

        return { categories }
      }
    )
}
