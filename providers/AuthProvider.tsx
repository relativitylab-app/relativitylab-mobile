import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AuthState,
  initialAuthState,
  mapAuthError,
  normalizeAuthUser,
  settleAuthState,
  settleGuestChoiceState,
} from "@/domain/auth";
import {
  AuthGateway,
  firebaseAuthGateway,
} from "@/infrastructure/firebase/authGateway";
import { asyncStorageAdapter } from "@/infrastructure/storage/asyncStorageAdapter";
import {
  KeyValueStorage,
  clearGuestChoice,
  loadGuestChoice,
  saveGuestChoice,
} from "@/infrastructure/storage/keyValueStorage";

type AuthAction = AuthState["action"];

export interface AuthContextValue extends AuthState {
  readonly signInWithGoogle: () => Promise<void>;
  readonly signInWithApple: () => Promise<void>;
  readonly continueAsGuest: () => Promise<void>;
  readonly returnToSignIn: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly clearError: () => void;
}

export interface AuthProviderProps {
  readonly children: ReactNode;
  readonly gateway?: AuthGateway;
  readonly storage?: KeyValueStorage;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({
  children,
  gateway = firebaseAuthGateway,
  storage = asyncStorageAdapter,
}: AuthProviderProps) => {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const inFlightActionRef = useRef<AuthAction>("none");

  useEffect(() => {
    let active = true;

    const unsubscribe = gateway.observeAuthState((nativeUser) => {
      if (!active) {
        return;
      }

      const user = normalizeAuthUser(nativeUser);

      setState((current) => ({
        ...settleAuthState(current, user),
        hasChosenGuest: user === null ? current.hasChosenGuest : false,
      }));

      if (user !== null) {
        void clearGuestChoice(storage).catch(() => undefined);
      }
    });

    void loadGuestChoice(storage)
      .then((choice) => {
        if (!active) {
          return;
        }

        setState((current) =>
          settleGuestChoiceState(current, current.user === null && choice === "guest"),
        );
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState((current) => settleGuestChoiceState(current, false));
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway, storage]);

  const runSingleFlight = useCallback(
    async (action: AuthAction, operation: () => Promise<void>): Promise<void> => {
      if (inFlightActionRef.current !== "none") {
        return;
      }

      inFlightActionRef.current = action;
      setState((current) => ({
        ...current,
        action,
        error: null,
      }));

      try {
        await operation();
      } catch (error) {
        const mappedError = mapAuthError(error);

        setState((current) => ({
          ...current,
          error: mappedError.category === "cancelled" ? null : mappedError,
        }));
      } finally {
        inFlightActionRef.current = "none";
        setState((current) => ({
          ...current,
          action: "none",
        }));
      }
    },
    [],
  );

  const signInWithGoogle = useCallback(
    () => runSingleFlight("google", () => gateway.signInWithGoogle()),
    [gateway, runSingleFlight],
  );

  const signInWithApple = useCallback(
    () => runSingleFlight("apple", () => gateway.signInWithApple()),
    [gateway, runSingleFlight],
  );

  const continueAsGuest = useCallback(
    () =>
      runSingleFlight("guest", async () => {
        await saveGuestChoice(storage, "guest");
        setState((current) => settleGuestChoiceState(current, true));
      }),
    [runSingleFlight, storage],
  );

  const returnToSignIn = useCallback(
    () =>
      runSingleFlight("guest", async () => {
        await clearGuestChoice(storage);
        setState((current) => settleGuestChoiceState(current, false));
      }),
    [runSingleFlight, storage],
  );

  const signOut = useCallback(
    () =>
      runSingleFlight("signOut", async () => {
        await clearGuestChoice(storage);
        setState((current) => settleGuestChoiceState(current, false));
        await gateway.signOut();
      }),
    [gateway, runSingleFlight, storage],
  );

  const clearError = useCallback(() => {
    setState((current) => ({
      ...current,
      error: null,
    }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signInWithGoogle,
      signInWithApple,
      continueAsGuest,
      returnToSignIn,
      signOut,
      clearError,
    }),
    [
      clearError,
      continueAsGuest,
      returnToSignIn,
      signInWithApple,
      signInWithGoogle,
      signOut,
      state,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
