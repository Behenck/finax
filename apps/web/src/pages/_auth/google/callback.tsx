import { normalizeApiError } from "@/errors/api-error";
import { resolveErrorMessage } from "@/errors";
import { auth } from "@/hooks/auth";
import { router } from "@/router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";

const GoogleCallbackSearchSchema = z.object({
	code: z.string().optional(),
});

export const Route = createFileRoute("/_auth/google/callback")({
	component: GoogleCallbackPage,
	validateSearch: (search) => GoogleCallbackSearchSchema.parse(search),
	head: () => ({
		meta: [{ title: "Login com Google | Finax" }],
	}),
});

function GoogleCallbackPage() {
	const { code } = Route.useSearch();
	const { mutateAsync } = auth.useCompleteGoogleSignIn();
	const didStartRef = useRef(false);

	useEffect(() => {
		if (didStartRef.current) {
			return;
		}

		didStartRef.current = true;

		const completeGoogleLogin = async () => {
			if (!code) {
				await router.navigate({
					to: "/sign-in",
					search: {
						oauthError: "Código de autenticação inválido.",
					},
					replace: true,
				});
				return;
			}

			try {
				await mutateAsync({ code });
				await router.navigate({
					to: "/",
					replace: true,
				});
			} catch (error) {
				const message = resolveErrorMessage(normalizeApiError(error));
				await router.navigate({
					to: "/sign-in",
					search: {
						oauthError: message,
					},
					replace: true,
				});
			}
		};

		void completeGoogleLogin();
	}, [code, mutateAsync]);

	return (
		<div className="w-full max-w-md space-y-2 text-center">
			<h2 className="text-xl font-semibold">Conectando sua conta</h2>
			<p className="text-muted-foreground text-sm">
				Aguarde enquanto finalizamos o login com Google.
			</p>
		</div>
	);
}
