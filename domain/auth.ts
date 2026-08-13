export type AuthStatus =
  | "initializing"
  | "signedOut"
  | "guest"
  | "authenticated";

export type AuthProviderId = "google.com" | "apple.com" | string;

export interface AuthUser {
  readonly uid: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly photoURL: string | null;
  readonly providerIds: readonly AuthProviderId[];
}

export type AuthErrorCategory =
  | "cancelled"
  | "network"
  | "credential"
  | "config"
  | "unavailable"
  | "accountConflict"
  | "unknown";

export interface AuthErrorState {
  readonly category: AuthErrorCategory;
  readonly retryable: boolean;
}

export interface AuthState {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  readonly hasChosenGuest: boolean;
  readonly initializingAuth: boolean;
  readonly initializingGuestChoice: boolean;
  readonly action: "none" | "google" | "apple" | "guest" | "signOut";
  readonly error: AuthErrorState | null;
}

export interface NativeAuthUser {
  readonly uid?: unknown;
  readonly displayName?: unknown;
  readonly email?: unknown;
  readonly photoURL?: unknown;
  readonly providerData?: unknown;
}

export const initialAuthState: AuthState = {
  status: "initializing",
  user: null,
  hasChosenGuest: false,
  initializingAuth: true,
  initializingGuestChoice: true,
  action: "none",
  error: null,
};

const nullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const providerIdFromValue = (value: unknown): AuthProviderId | null => {
  if (
    typeof value === "object" &&
    value !== null &&
    "providerId" in value &&
    typeof value.providerId === "string" &&
    value.providerId.length > 0
  ) {
    return value.providerId;
  }

  return null;
};

export const normalizeAuthUser = (user: NativeAuthUser | null): AuthUser | null => {
  if (user === null || typeof user.uid !== "string" || user.uid.length === 0) {
    return null;
  }

  const providerData = Array.isArray(user.providerData) ? user.providerData : [];
  const providerIds = Array.from(
    new Set(providerData.map(providerIdFromValue).filter(Boolean)),
  ) as AuthProviderId[];

  return {
    uid: user.uid,
    displayName: nullableString(user.displayName),
    email: nullableString(user.email),
    photoURL: nullableString(user.photoURL),
    providerIds,
  };
};

export const authError = (
  category: AuthErrorCategory,
  retryable: boolean,
): AuthErrorState => ({
  category,
  retryable,
});

const authErrorCode = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code.toLowerCase();
  }

  return "";
};

const authErrorName = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name.toLowerCase();
  }

  return "";
};

export const mapAuthError = (error: unknown): AuthErrorState => {
  const code = authErrorCode(error);
  const name = authErrorName(error);
  const identity = `${code} ${name}`;

  if (
    code.includes("account-exists-with-different-credential") ||
    name.includes("account-exists-with-different-credential")
  ) {
    return authError("accountConflict", false);
  }

  if (
    code.includes("err_request_canceled") ||
    name.includes("err_request_canceled") ||
    code.includes("sign_in_cancelled") ||
    name.includes("sign_in_cancelled") ||
    code.includes("cancelled") ||
    name.includes("cancelled") ||
    code.includes("canceled") ||
    name.includes("canceled")
  ) {
    return authError("cancelled", false);
  }

  if (identity.includes("network")) {
    return authError("network", true);
  }

  if (
    identity.includes("credential") ||
    identity.includes("token") ||
    identity.includes("id-token") ||
    identity.includes("invalid-credential")
  ) {
    return authError("credential", true);
  }

  if (identity.includes("config") || identity.includes("developer_error")) {
    return authError("config", false);
  }

  if (
    identity.includes("play-services") ||
    identity.includes("not-available") ||
    identity.includes("unavailable")
  ) {
    return authError("unavailable", true);
  }

  return authError("unknown", true);
};

export const deriveAuthStatus = (
  user: AuthUser | null,
  hasChosenGuest: boolean,
): AuthStatus => {
  if (user !== null) {
    return "authenticated";
  }

  return hasChosenGuest ? "guest" : "signedOut";
};

export const settleAuthState = (
  state: AuthState,
  user: AuthUser | null,
): AuthState => ({
  ...state,
  user,
  initializingAuth: false,
  status:
    state.initializingGuestChoice && user === null
      ? "initializing"
      : deriveAuthStatus(user, state.hasChosenGuest),
});

export const settleGuestChoiceState = (
  state: AuthState,
  hasChosenGuest: boolean,
): AuthState => ({
  ...state,
  hasChosenGuest,
  initializingGuestChoice: false,
  status:
    state.initializingAuth && state.user === null
      ? "initializing"
      : deriveAuthStatus(state.user, hasChosenGuest),
});

export const isStartupSettled = (state: AuthState): boolean =>
  !state.initializingAuth && !state.initializingGuestChoice;
