import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteComponent } from "../src/pages/_app/settings/index";

const mocks = vi.hoisted(() => ({
	useGetOrganizationSlugMock: vi.fn(),
	mutateAsyncMock: vi.fn(),
	invalidateQueriesMock: vi.fn(),
	successToastMock: vi.fn(),
	errorToastMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		createFileRoute: () => (options: unknown) => options,
	};
});

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "org-teste",
			name: "Finax",
			enableSalesTransactionsSync: false,
			preCancellationDelinquencyThreshold: null,
		},
	}),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-query")>();

	return {
		...actual,
		useQueryClient: () => ({
			invalidateQueries: mocks.invalidateQueriesMock,
		}),
	};
});

vi.mock("@/http/generated", () => ({
	getOrganizationSlugQueryKey: ({ slug }: { slug: string }) => [
		"organization",
		slug,
	],
	useGetOrganizationSlug: () => mocks.useGetOrganizationSlugMock(),
	usePutOrganizationSlug: () => ({
		mutateAsync: mocks.mutateAsyncMock,
		isPending: false,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: mocks.successToastMock,
		error: mocks.errorToastMock,
	},
}));

describe("settings pre-cancellation preferences", () => {
	beforeEach(() => {
		mocks.useGetOrganizationSlugMock.mockReset();
		mocks.mutateAsyncMock.mockReset();
		mocks.invalidateQueriesMock.mockReset();
		mocks.successToastMock.mockReset();
		mocks.errorToastMock.mockReset();
		mocks.invalidateQueriesMock.mockResolvedValue(undefined);
		mocks.mutateAsyncMock.mockResolvedValue(undefined);
		mocks.useGetOrganizationSlugMock.mockReturnValue({
			data: {
				organization: {
					name: "Finax",
					domain: null,
					shouldAttachUserByDomain: false,
					enableSalesTransactionsSync: false,
					preCancellationDelinquencyThreshold: 2,
				},
			},
		});
	});

	it("should persist the configured threshold", async () => {
		const user = userEvent.setup();
		render(<RouteComponent />);

		const input = screen.getByPlaceholderText("Deixe vazio para desativar");
		await user.clear(input);
		await user.type(input, "3");
		await user.click(
			screen.getByRole("button", {
				name: "Salvar Preferências",
			}),
		);

		await waitFor(() => {
			expect(mocks.mutateAsyncMock).toHaveBeenCalledWith({
				slug: "org-teste",
				data: expect.objectContaining({
					preCancellationDelinquencyThreshold: 3,
				}),
			});
		});
	});

	it("should send null when the threshold field is cleared", async () => {
		const user = userEvent.setup();
		render(<RouteComponent />);

		const input = screen.getByPlaceholderText("Deixe vazio para desativar");
		await user.clear(input);
		await user.click(
			screen.getByRole("button", {
				name: "Salvar Preferências",
			}),
		);

		await waitFor(() => {
			expect(mocks.mutateAsyncMock).toHaveBeenCalledWith({
				slug: "org-teste",
				data: expect.objectContaining({
					preCancellationDelinquencyThreshold: null,
				}),
			});
		});
	});
});
