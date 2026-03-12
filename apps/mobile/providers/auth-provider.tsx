import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  bootstrapAuthTokens,
  onAuthInvalidated,
  setAuthTokens,
} from "@/lib/api";
import {
  getSession,
  signInWithOtp,
  signInWithPassword,
  type SignInWithOtpInput,
  type SignInWithPasswordInput,
} from "@/lib/auth-service";
import type { SessionResponse } from "@/types/auth";

type AuthContextValue = {
  session: SessionResponse | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  reloadSession: () => Promise<SessionResponse | null>;
  signIn: (input: SignInWithPasswordInput) => Promise<void>;
  signInWithOtp: (input: SignInWithOtpInput) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const reloadSession = useCallback(async (): Promise<SessionResponse | null> => {
    const nextSession = await getSession();
    setSession(nextSession);
    return nextSession;
  }, []);

  const hydrateSession = useCallback(async () => {
    const storedTokens = await bootstrapAuthTokens();

    if (!storedTokens?.accessToken) {
      setSession(null);
      setIsBootstrapping(false);
      return;
    }

    try {
      await reloadSession();
    } catch {
      await setAuthTokens(null);
      setSession(null);
    } finally {
      setIsBootstrapping(false);
    }
  }, [reloadSession]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    return onAuthInvalidated(() => {
      setSession(null);
    });
  }, []);

  const signIn = useCallback(
    async (input: SignInWithPasswordInput): Promise<void> => {
      const tokens = await signInWithPassword(input);
      await setAuthTokens(tokens);
      await reloadSession();
    },
    [reloadSession],
  );

  const signInWithOtpHandler = useCallback(
    async (input: SignInWithOtpInput): Promise<void> => {
      const tokens = await signInWithOtp(input);
      await setAuthTokens(tokens);
      await reloadSession();
    },
    [reloadSession],
  );

  const signOut = useCallback(async () => {
    await setAuthTokens(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isBootstrapping,
      isAuthenticated: Boolean(session),
      reloadSession,
      signIn,
      signInWithOtp: signInWithOtpHandler,
      signOut,
    }),
    [isBootstrapping, reloadSession, session, signIn, signInWithOtpHandler, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
