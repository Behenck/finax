import { useSession } from "./use-session";
import { useSignIn } from "./use-sign-in";
import { useSignInOTP } from "./use-sign-in-otp";
import { useSignOut } from "./use-sign-out";

export const auth = {
	useSession,
	useSignIn,
	useSignOut,
	useSignInOTP,
};
