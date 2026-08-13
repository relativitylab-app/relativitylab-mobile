const mockAuthInstance = { app: "auth" };

const mockConfigure = jest.fn();
const mockHasPlayServices = jest.fn();
const mockGoogleSignIn = jest.fn();
const mockFirebaseSignInWithCredential = jest.fn();
const mockFirebaseSignOut = jest.fn();
const mockGoogleCredential = jest.fn((idToken: string) => ({
  providerId: "google.com",
  idToken,
}));
const mockAppleCredential = jest.fn((identityToken: string, rawNonce: string) => ({
  providerId: "apple.com",
  identityToken,
  rawNonce,
}));
const mockAppleSignInAsync = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockRandomUUID = jest.fn();
const mockOnAuthStateChanged = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: mockConfigure,
    hasPlayServices: mockHasPlayServices,
    signIn: mockGoogleSignIn,
  },
}));

jest.mock("@react-native-firebase/auth", () => ({
  AppleAuthProvider: { credential: mockAppleCredential },
  getAuth: jest.fn(() => mockAuthInstance),
  GoogleAuthProvider: { credential: mockGoogleCredential },
  onAuthStateChanged: mockOnAuthStateChanged,
  signInWithCredential: mockFirebaseSignInWithCredential,
  signOut: mockFirebaseSignOut,
}));

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: {
    FULL_NAME: "FULL_NAME",
    EMAIL: "EMAIL",
  },
  signInAsync: mockAppleSignInAsync,
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  digestStringAsync: mockDigestStringAsync,
  randomUUID: mockRandomUUID,
}));

describe("Firebase auth gateway", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("extracts the Google ID token from v13 response data", () => {
    const { extractGoogleIdToken } = require("@/infrastructure/firebase/authGateway");

    expect(extractGoogleIdToken({ data: { idToken: "v13-token" } })).toBe(
      "v13-token",
    );
  });

  it("extracts the Google ID token from legacy response fields", () => {
    const { extractGoogleIdToken } = require("@/infrastructure/firebase/authGateway");

    expect(extractGoogleIdToken({ idToken: "legacy-token" })).toBe(
      "legacy-token",
    );
  });

  it("throws a cancellation-coded error for cancelled Google responses", () => {
    const { extractGoogleIdToken } = require("@/infrastructure/firebase/authGateway");

    expect(() => extractGoogleIdToken({ type: "cancelled" })).toThrow(
      expect.objectContaining({
        name: "AuthCancelledError",
        code: "SIGN_IN_CANCELLED",
      }),
    );
  });

  it("throws a credential-coded error when Google response has no token", () => {
    const { extractGoogleIdToken } = require("@/infrastructure/firebase/authGateway");

    expect(() => extractGoogleIdToken({ data: { idToken: null } })).toThrow(
      expect.objectContaining({
        name: "AuthCredentialError",
        code: "AUTH_INVALID_CREDENTIAL",
      }),
    );
  });

  it("does not log or persist Google ID tokens during Firebase sign-in", async () => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGoogleSignIn.mockResolvedValue({ data: { idToken: "secret-google-token" } });
    mockFirebaseSignInWithCredential.mockResolvedValue(undefined);
    const { createFirebaseAuthGateway } = require("@/infrastructure/firebase/authGateway");
    const firebaseAuthGateway = createFirebaseAuthGateway({
      getGoogleWebClientId: () => "web-client",
    });

    await firebaseAuthGateway.signInWithGoogle();

    expect(mockFirebaseSignInWithCredential).toHaveBeenCalledWith(mockAuthInstance, {
      providerId: "google.com",
      idToken: "secret-google-token",
    });
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("configures Google sign-in once per gateway", async () => {
    mockGoogleSignIn
      .mockResolvedValueOnce({ data: { idToken: "first-token" } })
      .mockResolvedValueOnce({ data: { idToken: "second-token" } });
    mockFirebaseSignInWithCredential.mockResolvedValue(undefined);
    const { createFirebaseAuthGateway } = require("@/infrastructure/firebase/authGateway");
    const firebaseAuthGateway = createFirebaseAuthGateway({
      getGoogleWebClientId: () => "web-client",
    });

    await firebaseAuthGateway.signInWithGoogle();
    await firebaseAuthGateway.signInWithGoogle();

    expect(mockConfigure).toHaveBeenCalledTimes(1);
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: "web-client" });
    expect(mockGoogleSignIn).toHaveBeenCalledTimes(2);
  });

  it("does not log or persist Apple identity tokens or nonces during Firebase sign-in", async () => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockRandomUUID.mockReturnValue("raw-nonce");
    mockDigestStringAsync.mockResolvedValue("hashed-nonce");
    mockAppleSignInAsync.mockResolvedValue({ identityToken: "secret-apple-token" });
    mockFirebaseSignInWithCredential.mockResolvedValue(undefined);
    const { firebaseAuthGateway } = require("@/infrastructure/firebase/authGateway");

    await firebaseAuthGateway.signInWithApple();

    expect(mockAppleSignInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: "hashed-nonce" }),
    );
    expect(mockFirebaseSignInWithCredential).toHaveBeenCalledWith(mockAuthInstance, {
      providerId: "apple.com",
      identityToken: "secret-apple-token",
      rawNonce: "raw-nonce",
    });
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
