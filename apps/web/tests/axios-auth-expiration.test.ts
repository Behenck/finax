import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	invalidateMock: vi.fn().mockResolvedValue(undefined),
	navigateMock: vi.fn().mockResolvedValue(undefined),
	removeAuthTokenMock: vi.fn(),
	setQueryDataMock: vi.fn(),
	toastErrorMock: vi.fn(),
}));

vi.mock("@/router", () => ({
	router: {
		invalidate: mocks.invalidateMock,
		navigate: mocks.navigateMock,
	},
}));

vi.mock("@/lib/query-client", () => ({
	queryClient: {
		setQueryData: mocks.setQueryDataMock,
	},
}));

vi.mock("@/lib/auth-token", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-token")>();

	return {
		...actual,
		removeAuthToken: mocks.removeAuthTokenMock,
	};
});

vi.mock("sonner", () => ({
	toast: {
		error: mocks.toastErrorMock,
	},
}));

function getRejectedResponseHandler() {
	const handlers = (
		api.interceptors.response as unknown as {
			handlers: Array<{
				rejected?: (error: unknown) => Promise<never>;
			}>;
		}
	).handlers;

	return handlers.at(-1)?.rejected;
}

import { api } from "../src/lib/axios";

describe("axios auth expiration interceptor", () => {
	beforeEach(() => {
		mocks.invalidateMock.mockClear();
		mocks.navigateMock.mockClear();
		mocks.removeAuthTokenMock.mockClear();
		mocks.setQueryDataMock.mockClear();
		mocks.toastErrorMock.mockClear();
	});

	it("should logout and redirect when an authenticated request returns 401", async () => {
		const rejected = getRejectedResponseHandler();
		const error = {
			response: {
				status: 401,
				data: {
					message: "Invalid auth token",
				},
			},
			config: {
				url: "/organizations/org-test/sales",
				baseURL: "http://localhost:3333",
				headers: {
					Authorization: "Bearer expired-token",
				},
			},
		};

		await expect(rejected?.(error)).rejects.toBe(error);

		expect(mocks.toastErrorMock).toHaveBeenCalledWith(
			"Sua sessão expirou. Faça login novamente.",
		);
		expect(mocks.removeAuthTokenMock).toHaveBeenCalledTimes(1);
		expect(mocks.setQueryDataMock).toHaveBeenCalledWith(["session"], null);
		expect(mocks.invalidateMock).toHaveBeenCalledTimes(1);
		expect(mocks.navigateMock).toHaveBeenCalledWith({
			to: "/sign-in",
			replace: true,
		});
	});

	it("should avoid duplicate logout side effects when multiple authenticated requests return 401", async () => {
		const rejected = getRejectedResponseHandler();
		const firstError = {
			response: { status: 401 },
			config: {
				url: "/organizations/org-test/sales",
				baseURL: "http://localhost:3333",
				headers: {
					Authorization: "Bearer expired-token",
				},
			},
		};
		const secondError = {
			response: { status: 401 },
			config: {
				url: "/organizations/org-test/customers",
				baseURL: "http://localhost:3333",
				headers: {
					Authorization: "Bearer expired-token",
				},
			},
		};

		await Promise.allSettled([rejected?.(firstError), rejected?.(secondError)]);

		expect(mocks.toastErrorMock).toHaveBeenCalledTimes(1);
		expect(mocks.removeAuthTokenMock).toHaveBeenCalledTimes(1);
		expect(mocks.invalidateMock).toHaveBeenCalledTimes(1);
		expect(mocks.navigateMock).toHaveBeenCalledTimes(1);
	});

	it("should not logout for public auth endpoints that can return 401", async () => {
		const rejected = getRejectedResponseHandler();
		const error = {
			response: {
				status: 401,
				data: {
					message: "Credenciais inválidas.",
				},
			},
			config: {
				url: "/sessions/password",
				baseURL: "http://localhost:3333",
				headers: {
					Authorization: "Bearer stale-token",
				},
			},
		};

		await expect(rejected?.(error)).rejects.toBe(error);

		expect(mocks.toastErrorMock).not.toHaveBeenCalled();
		expect(mocks.removeAuthTokenMock).not.toHaveBeenCalled();
		expect(mocks.invalidateMock).not.toHaveBeenCalled();
		expect(mocks.navigateMock).not.toHaveBeenCalled();
	});
});
