import * as AppleAuthentication from "expo-apple-authentication";
import {
  AppleAuthProvider,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
} from "@react-native-firebase/auth";
import type { User } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  CryptoDigestAlgorithm,
  digestStringAsync,
  randomUUID,
} from "expo-crypto";

import { NativeAuthUser } from "@/domain/auth";

export type AuthObserver = (user: NativeAuthUser | null) => void;

export interface AuthGateway {
  readonly observeAuthState: (observer: AuthObserver) => () => void;
  readonly signInWithGoogle: () => Promise<void>;
  readonly signInWithApple: () => Promise<void>;
  readonly signOut: () => Promise<void>;
}

export interface FirebaseAuthGatewayOptions {
  readonly getGoogleWebClientId?: () => string | undefined;
}

type AuthErrorCode =
  | "AUTH_CONFIG"
  | "AUTH_INVALID_CREDENTIAL"
  | "SIGN_IN_CANCELLED";

type CodedAuthError = Error & { code: AuthErrorCode };

type GoogleSignInResponse = {
  readonly type?: string;
  readonly data?: {
    readonly idToken?: string | null;
  } | null;
  readonly idToken?: string | null;
};

const createAuthError = (
  message: string,
  name: string,
  code: AuthErrorCode,
): CodedAuthError => {
  const error = new Error(message) as CodedAuthError;
  error.name = name;
  error.code = code;
  return error;
};

const getGoogleWebClientIdFromEnv = (): string | undefined =>
  process.env["EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"];

const requireGoogleWebClientId = (
  getGoogleWebClientId: () => string | undefined,
): string => {
  const googleWebClientId = getGoogleWebClientId();

  if (
    typeof googleWebClientId !== "string" ||
    googleWebClientId.trim() === ""
  ) {
    throw createAuthError(
      "Missing Google web client ID configuration",
      "AuthConfigError",
      "AUTH_CONFIG",
    );
  }

  return googleWebClientId;
};

export const extractGoogleIdToken = (response: GoogleSignInResponse): string => {
  if (response.type === "cancelled") {
    throw createAuthError(
      "Google sign-in was cancelled",
      "AuthCancelledError",
      "SIGN_IN_CANCELLED",
    );
  }

  let idToken: string | null | undefined = null;

  if ("data" in response && response.data !== undefined && response.data !== null) {
    idToken = response.data.idToken;
  } else if ("idToken" in response) {
    idToken = response.idToken;
  }

  if (typeof idToken !== "string" || idToken.length === 0) {
    throw createAuthError(
      "Google sign-in did not return an ID token",
      "AuthCredentialError",
      "AUTH_INVALID_CREDENTIAL",
    );
  }

  return idToken;
};

export const createRawNonce = (): string => randomUUID();

export const sha256 = (value: string): Promise<string> =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, value);

export const createFirebaseAuthGateway = (
  options: FirebaseAuthGatewayOptions = {},
): AuthGateway => {
  const getGoogleWebClientId =
    options.getGoogleWebClientId ?? getGoogleWebClientIdFromEnv;
  let googleConfigured = false;

  const configureGoogleSigninOnce = (): void => {
    if (googleConfigured) {
      return;
    }

    const webClientId = requireGoogleWebClientId(getGoogleWebClientId);
    GoogleSignin.configure({
      webClientId,
    });
    googleConfigured = true;
  };

  const getGoogleIdToken = async (): Promise<string> => {
    configureGoogleSigninOnce();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    return extractGoogleIdToken(response);
  };

  return {
    observeAuthState: (observer) =>
      onAuthStateChanged(getAuth(), (user: User | null) => {
        observer(user);
      }),

    signInWithGoogle: async () => {
      const idToken = await getGoogleIdToken();
      const credential = GoogleAuthProvider.credential(idToken);

      await signInWithCredential(getAuth(), credential);
    },

    signInWithApple: async () => {
      const rawNonce = createRawNonce();
      const hashedNonce = await sha256(rawNonce);
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (
        typeof appleCredential.identityToken !== "string" ||
        appleCredential.identityToken.length === 0
      ) {
        throw createAuthError(
          "Apple sign-in did not return an identity token",
          "AuthCredentialError",
          "AUTH_INVALID_CREDENTIAL",
        );
      }

      const credential = AppleAuthProvider.credential(
        appleCredential.identityToken,
        rawNonce,
      );

      await signInWithCredential(getAuth(), credential);
    },

    signOut: async () => {
      await firebaseSignOut(getAuth());
    },
  };
};

export const firebaseAuthGateway: AuthGateway = createFirebaseAuthGateway();

export type FirebaseAuthUser = User;
