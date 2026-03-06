import { useSession } from "./use-session";
import { useCompleteGoogleSignIn } from "./use-complete-google-sign-in";
import { useGoogleLinkStatus } from "./use-google-link-status";
import { useLinkGoogleAccount } from "./use-link-google-account";
import { useSignIn } from "./use-sign-in";
import { useSignInOTP } from "./use-sign-in-otp";
import { useSignOut } from "./use-sign-out";
import { useSyncGoogleProfile } from "./use-sync-google-profile";
import { useUpdateProfile } from "./use-update-profile";
import { useChangePassword } from "./use-change-password";

export const auth = {
	useSession,
	useCompleteGoogleSignIn,
	useGoogleLinkStatus,
	useLinkGoogleAccount,
	useSyncGoogleProfile,
	useSignIn,
	useSignOut,
	useSignInOTP,
	useUpdateProfile,
	useChangePassword,
};
