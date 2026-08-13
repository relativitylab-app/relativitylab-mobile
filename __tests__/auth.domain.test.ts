import {
  initialAuthState,
  isStartupSettled,
  mapAuthError,
  normalizeAuthUser,
  settleAuthState,
  settleGuestChoiceState,
} from "@/domain/auth";

describe("auth domain", () => {
  it("normalizes empty identity fields to null and keeps unique non-empty provider IDs", () => {
    expect(
      normalizeAuthUser({
        uid: "user-1",
        displayName: "",
        email: null,
        photoURL: undefined,
        providerData: [
          { providerId: "google.com" },
          { providerId: "" },
          { providerId: null },
          { providerId: "google.com" },
          { providerId: "apple.com" },
        ],
      }),
    ).toEqual({
      uid: "user-1",
      displayName: null,
      email: null,
      photoURL: null,
      providerIds: ["google.com", "apple.com"],
    });
  });

  it("returns null when the native user has a missing uid", () => {
    expect(normalizeAuthUser({ uid: null })).toBeNull();
  });

  it("keeps startup unsettled after observer fires while guest choice is still loading", () => {
    const state = settleAuthState(initialAuthState, null);

    expect(isStartupSettled(state)).toBe(false);
    expect(state.status).toBe("initializing");
  });

  it("settles startup after observer fires and guest choice has loaded", () => {
    const state = settleAuthState(
      settleGuestChoiceState(initialAuthState, true),
      null,
    );

    expect(isStartupSettled(state)).toBe(true);
    expect(state.status).toBe("guest");
  });

  it("keeps startup unsettled after guest choice loads while observer is still pending", () => {
    const state = settleGuestChoiceState(initialAuthState, true);

    expect(isStartupSettled(state)).toBe(false);
    expect(state.status).toBe("initializing");
  });

  it("settles startup after guest choice loads and observer has fired", () => {
    const state = settleGuestChoiceState(settleAuthState(initialAuthState, null), true);

    expect(isStartupSettled(state)).toBe(true);
    expect(state.status).toBe("guest");
  });

  it.each([
    [{ code: "auth/account-exists-with-different-credential" }, "accountConflict", false],
    [{ name: "ERR_REQUEST_CANCELED" }, "cancelled", false],
    [{ code: "auth/network-request-failed" }, "network", true],
    [{ name: "AuthCredentialError" }, "credential", true],
    [{ code: "AUTH_CONFIG" }, "config", false],
    [{ code: "auth/unavailable" }, "unavailable", true],
    [{ code: "auth/unmapped" }, "unknown", true],
  ] as const)(
    "maps auth error from code/name to the expected category",
    (error, category, retryable) => {
      expect(mapAuthError(error)).toEqual({ category, retryable });
    },
  );

  it("does not map auth errors from message text", () => {
    expect(
      mapAuthError({
        message: "network token cancelled config unavailable credential",
      }),
    ).toEqual({ category: "unknown", retryable: true });
  });
});
