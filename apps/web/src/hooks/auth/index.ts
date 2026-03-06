import { useSession } from "./use-session";
import { useSignIn } from "./use-sign-in";
import { useSignInOTP } from "./use-sign-in-otp";
import { useSignOut } from "./use-sign-out";
import { useUpdateProfile } from "./use-update-profile";
import { useChangePassword } from "./use-change-password";

export const auth = {
	useSession,
	useSignIn,
	useSignOut,
	useSignInOTP,
	useUpdateProfile,
	useChangePassword,
};
