import { toast } from "sonner";
import { router } from "@/router";
import { removeAuthToken } from "./auth-token";
import { queryClient } from "./query-client";

type ClientSignOutReason = "manual" | "expired";

type ClientSignOutOptions = {
	reason?: ClientSignOutReason;
	message?: string;
};

const DEFAULT_EXPIRED_SESSION_MESSAGE =
	"Sua sessão expirou. Faça login novamente.";

let activeSignOutPromise: Promise<void> | null = null;

export async function performClientSignOut({
	reason = "manual",
	message = DEFAULT_EXPIRED_SESSION_MESSAGE,
}: ClientSignOutOptions = {}) {
	if (activeSignOutPromise) {
		return activeSignOutPromise;
	}

	activeSignOutPromise = (async () => {
		if (reason === "expired") {
			toast.error(message);
		}

		removeAuthToken();
		queryClient.setQueryData(["session"], null);

		await router.invalidate();
		await router.navigate({
			to: "/sign-in",
			replace: true,
		});
	})().finally(() => {
		activeSignOutPromise = null;
	});

	return activeSignOutPromise;
}
