import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryForm } from "@/pages/_app/registers/categories/-components/category-form";
import type { Category } from "@/schemas/types/category";

const mocks = vi.hoisted(() => ({
	createCategoryMock: vi.fn().mockResolvedValue(undefined),
	updateCategoryMock: vi.fn().mockResolvedValue(undefined),
	invalidateQueriesMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/context/app-context", () => ({
	useApp: () => ({
		organization: {
			slug: "test-org",
		},
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({
		invalidateQueries: mocks.invalidateQueriesMock,
	}),
}));

vi.mock("@/http/generated", () => ({
	getOrganizationsSlugCategoriesQueryKey: () => ["categories", "test-org"],
	usePostOrganizationsSlugCategories: () => ({
		mutateAsync: mocks.createCategoryMock,
		isPending: false,
	}),
	usePutOrganizationsSlugCategoriesId: () => ({
		mutateAsync: mocks.updateCategoryMock,
		isPending: false,
	}),
}));

vi.mock("@/components/lucide-icon", () => ({
	getLucideIcon: () => () => <span data-testid="mock-icon" />,
}));

const initialCategory: Category = {
	id: "category-id",
	name: "Categoria Inicial",
	code: null,
	type: "OUTCOME",
	color: "#22C55E",
	icon: "Wallet",
	parentId: null,
	children: [],
};

describe("CategoryForm", () => {
	beforeEach(() => {
		mocks.createCategoryMock.mockClear();
		mocks.updateCategoryMock.mockClear();
		mocks.invalidateQueriesMock.mockClear();
	});

	it("should keep save button disabled on create while category name is empty", () => {
		render(<CategoryForm mode="create" />);

		expect(
			screen.getByRole("button", {
				name: "Salvar",
			}),
		).toBeDisabled();
	});

	it("should keep save button disabled when category name has only whitespace", () => {
		render(
			<CategoryForm
				mode="edit"
				initialData={initialCategory}
				parentId={initialCategory.parentId ?? undefined}
			/>,
		);

		const nameInput = screen.getByLabelText("Nome");
		fireEvent.change(nameInput, {
			target: {
				value: "   ",
			},
		});

		expect(
			screen.getByRole("button", {
				name: "Salvar",
			}),
		).toBeDisabled();
	});

	it("should enable save button when category name is valid", () => {
		render(
			<CategoryForm
				mode="edit"
				initialData={initialCategory}
				parentId={initialCategory.parentId ?? undefined}
			/>,
		);

		const nameInput = screen.getByLabelText("Nome");
		fireEvent.change(nameInput, {
			target: {
				value: "Categoria Atualizada",
			},
		});

		const saveButton = screen.getByRole("button", {
			name: "Salvar",
		});
		expect(saveButton).toBeEnabled();
	});

	it("should block submit when category name has only whitespace even on form submit", () => {
		render(
			<CategoryForm
				mode="edit"
				initialData={initialCategory}
				parentId={initialCategory.parentId ?? undefined}
			/>,
		);

		const nameInput = screen.getByLabelText("Nome");
		fireEvent.change(nameInput, {
			target: {
				value: "   ",
			},
		});

		const formElement = nameInput.closest("form");
		expect(formElement).not.toBeNull();
		if (!formElement) {
			throw new Error("Category form not found");
		}

		fireEvent.submit(formElement);

		expect(mocks.updateCategoryMock).not.toHaveBeenCalled();
	});
});
