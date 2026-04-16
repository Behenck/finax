import fastify from "fastify";
import {
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
	ZodTypeProvider,
} from "fastify-type-provider-zod";
import { fastifyCors, type FastifyCorsOptions } from "@fastify/cors";
import { fastifyJwt } from "@fastify/jwt";
import { fastifySwagger } from "@fastify/swagger";
import ScalarApiReference from "@scalar/fastify-api-reference";

import { authRoutes } from "./routes/auth";
import { inviteRoutes } from "./routes/invites";
import { memberRoutes } from "./routes/members";
import { organizationRoutes } from "./routes/orgs";
import { companyRoutes } from "./routes/companies";
import { unitRoutes } from "./routes/units";
import { categoryRoutes } from "./routes/categories";
import { costCenterRoutes } from "./routes/cost-centers";
import { employeeRoutes } from "./routes/employees";
import { transactionRoutes } from "./routes/transactions";
import { recurrencesRoutes } from "./routes/recurrences";
import { customerRoute } from "./routes/customers";
import { partnerRoutes } from "./routes/partners";
import { sellerRoutes } from "./routes/sellers";
import { productRoutes } from "./routes/products";
import { saleRoutes } from "./routes/sales";
import { permissionRoutes } from "./routes/permissions";
import {
	getAllowedAppWebOrigins,
	getDefaultAppWebUrl,
	normalizeOrigin,
} from "./routes/auth/app-web-url";

function getCorsAllowedOrigins() {
	const configuredOrigins = getAllowedAppWebOrigins();

	if (configuredOrigins.length > 0) {
		return configuredOrigins;
	}

	return [getDefaultAppWebUrl()];
}

export function buildApp() {
	const app = fastify().withTypeProvider<ZodTypeProvider>();
	const allowedCorsOrigins = getCorsAllowedOrigins();
	const corsOrigin: FastifyCorsOptions["origin"] = (origin, callback) => {
		if (!origin) {
			callback(null, true);
			return;
		}

		const normalizedOrigin = normalizeOrigin(origin);
		callback(
			null,
			Boolean(
				normalizedOrigin && allowedCorsOrigins.includes(normalizedOrigin),
			),
		);
	};

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	app.register(fastifyCors, {
		origin: corsOrigin,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		credentials: true,
	});

	app.register(fastifySwagger, {
		openapi: {
			info: {
				title: "Webhook Inspector API",
				description: "API for capturing and inspecting webhook requests",
				version: "1.0.0",
			},
			servers: [],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
				},
			},
		},
		transform: jsonSchemaTransform,
	});

	app.register(ScalarApiReference, {
		routePrefix: "/docs",
		configuration: {
			authentication: {
				preferredSecurityScheme: "bearerAuth",
			},
		},
	});

	app.get("/docs/json", async () => {
		return app.swagger();
	});

	app.get("/health", async () => {
		return {
			status: "ok",
			uptime: process.uptime(),
			timestamp: new Date().toISOString(),
		};
	});

	const jwtSecret = process.env.JWT_SECRET;
	if (!jwtSecret) {
		throw new Error("🚨 variável de ambiente JWT_SECRET não definida!");
	}

	app.register(fastifyJwt, {
		secret: jwtSecret,
		sign: {
			expiresIn: "1d",
		},
	});

	app.register(authRoutes);
	app.register(inviteRoutes);
	app.register(memberRoutes);
	app.register(permissionRoutes);
	app.register(organizationRoutes);

	app.register(companyRoutes);
	app.register(unitRoutes);
	app.register(categoryRoutes);
	app.register(costCenterRoutes);
	app.register(employeeRoutes);

	app.register(customerRoute);
	app.register(partnerRoutes);
	app.register(sellerRoutes);
	app.register(productRoutes);
	app.register(saleRoutes);

	app.register(transactionRoutes);
	app.register(recurrencesRoutes);

	return app;
}
