import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeesPage } from "../src/pages/_app/registers/employees/index";

const mocks = vi.hoisted(() => {
	const defaults: Record<string, unknown> = {
		q: "",
		page: 2,
		pageSize: 20,
	};

	const values = new Map<string, unknown>(Object.entries(defaults));
	const setCalls = vi.fn<(key: string, value: unknown) => void>();

	function reset(nextValues: Partial<typeof defaults> = {}) {
		values.clear();
		for (const [key, value] of Object.entries({
			...defaults,
			...nextValues,
		})) {
			values.set(key, value);
		}
		setCalls.mockReset();
	}

	return {
		values,
		setCalls,
		reset,
	};
});

function buildEmployees(total: number) {
	return Array.from({ length: total }, (_, index) => ({
		id: `employee-${index + 1}`,
		name: `Funcionário ${index + 1}`,
		email: `funcionario${index + 1}@finax.test`,
		role: "Consultor",
		department: "Comercial",
		phone: `119999900${String(index + 1).padStart(2, "0")}`,
		company: {
			id: "company-1",
			name: "Empresa Alpha",
		},
		unit: null,
		linkedUser: null,
	}));
}

vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("nuqs")>();
	const React = await import("react");

	return {
		...actual,
		useQueryState: (key: string) => {
			const [value, setValue] = React.useState(() => mocks.values.get(key));

			const setQueryState = (
				next: unknown | ((previous: unknown) => unknown),
			) => {
				setValue((previous) => {
					const resolvedValue =
						typeof next === "function"
							? (next as (previous: unknown) => unknown)(previous)
							: next;
					mocks.values.set(key, resolvedValue);
					mocks.setCalls(key, resolvedValue);
					return resolvedValue;
				});

				return Promise.resolve(null);
			};

			return [
				value,
				setQueryState as Dispatch<SetStateAction<unknown>>,
			] as const;
		},
	};
});

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => () => ({}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
	}),
}));

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "acme",
		},
	}),
}));

vi.mock("@/http/generated", () => ({
	useGetOrganizationsSlugEmployees: () => ({
		data: {
			employees: buildEmployees(25),
		},
		isLoading: false,
		isError: false,
	}),
	useDeleteOrganizationsSlugEmployeesEmployeeid: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	getOrganizationsSlugEmployeesQueryKey: vi.fn(),
}));

vi.mock("@/pages/_app/registers/employees/-components/create-employee", () => ({
	CreateEmployee: () => <button type="button">Novo funcionário</button>,
}));

vi.mock("@/pages/_app/registers/employees/-components/update-employee", () => ({
	UpdateEmployee: () => <button type="button">Editar</button>,
}));

vi.mock(
	"@/pages/_app/registers/employees/-components/employee-linked-user-badge",
	() => ({
		EmployeeLinkedUserBadge: () => <span>Sem acesso</span>,
	}),
);

describe("EmployeesPage pagination", () => {
	beforeEach(() => {
		mocks.reset();
	});

	it("should paginate the filtered list and reset to page 1 after search changes", async () => {
		const user = userEvent.setup();

		render(<EmployeesPage />);

		expect(
			screen.getByText((_, element) => {
				return element?.textContent === "Página 2 de 2";
			}),
		).toBeInTheDocument();
		expect(screen.queryByText("Funcionário 1")).not.toBeInTheDocument();
		expect(screen.getAllByText("Funcionário 21").length).toBeGreaterThan(0);

		await user.clear(
			screen.getByPlaceholderText(
				"Buscar por nome, e-mail, cargo ou telefone...",
			),
		);
		await user.type(
			screen.getByPlaceholderText(
				"Buscar por nome, e-mail, cargo ou telefone...",
			),
			"Funcionário 1",
		);

		await waitFor(() => {
			expect(
				screen.getByText((_, element) => {
					return element?.textContent === "Página 1 de 1";
				}),
			).toBeInTheDocument();
		});

		expect(screen.getAllByText("Funcionário 1").length).toBeGreaterThan(0);
		expect(screen.queryByText("Funcionário 21")).not.toBeInTheDocument();
		expect(mocks.setCalls).toHaveBeenCalledWith("page", 1);
	});
});
