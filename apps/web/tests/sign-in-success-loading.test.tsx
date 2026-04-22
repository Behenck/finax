import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignIn } from "../src/pages/_auth/sign-in";

const mocks = vi.hoisted(() => {
	return {
		mutateAsync: vi.fn(),
		sendEmailOtp: vi.fn(),
		navigate: vi.fn(),
		toastSuccess: vi.fn(),
		toastError: vi.fn(),
	};
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();

	return {
		...actual,
		createFileRoute: () => () => ({
			useSearch: () => ({
				email: undefined,
				oauthError: undefined,
			}),
		}),
		Link: ({ children, ...props }: ComponentProps<"a"> & { to: string }) => (
			<a {...props}>{children}</a>
		),
		Navigate: () => null,
	};
});

vi.mock("@/hooks/auth", () => ({
	auth: {
		useSignIn: () => ({
			mutateAsync: mocks.mutateAsync,
		}),
		useSession: () => ({
			data: null,
			isPending: false,
		}),
	},
}));

vi.mock("@/http/generated", () => ({
	usePostAuthSendEmailOtp: () => ({
		mutateAsync: mocks.sendEmailOtp,
	}),
}));

vi.mock("@/router", () => ({
	router: {
		navigate: mocks.navigate,
	},
}));

vi.mock("sonner", () => ({
	toast: {
		success: mocks.toastSuccess,
		error: mocks.toastError,
	},
}));

describe("SignIn", () => {
	beforeEach(() => {
		mocks.mutateAsync.mockReset();
		mocks.sendEmailOtp.mockReset();
		mocks.navigate.mockReset();
		mocks.toastSuccess.mockReset();
		mocks.toastError.mockReset();

		mocks.mutateAsync.mockResolvedValue({
			accessToken: "token",
		});
		mocks.navigate.mockResolvedValue(undefined);
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 0;
		});
	});

	it("replaces the form with a redirect loading state after successful login", async () => {
		const user = userEvent.setup();

		render(<SignIn />);

		await user.type(
			screen.getByPlaceholderText("seu@email.com"),
			"user@example.com",
		);
		await user.type(screen.getByPlaceholderText("************"), "123456");
		await user.click(screen.getByRole("button", { name: /entrar/i }));

		expect(await screen.findByText("Realizando login...")).toBeInTheDocument();
		expect(
			screen.getByText("Redirecionando voce para o sistema."),
		).toBeInTheDocument();
		expect(
			screen.queryByPlaceholderText("seu@email.com"),
		).not.toBeInTheDocument();
		expect(mocks.mutateAsync).toHaveBeenCalledWith({
			email: "user@example.com",
			password: "123456",
		});
		await waitFor(() => {
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: "/",
				replace: true,
			});
		});
	});
});
