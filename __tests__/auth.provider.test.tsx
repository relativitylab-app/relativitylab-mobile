import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { AuthContextValue, AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AuthGateway, AuthObserver } from "@/infrastructure/firebase/authGateway";
import {
  KeyValueStorage,
  storageKeys,
} from "@/infrastructure/storage/keyValueStorage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  readonly getItem = jest.fn(async (key: string) => this.values.get(key) ?? null);
  readonly setItem = jest.fn(async (key: string, value: string) => {
    this.values.set(key, value);
  });
  readonly removeItem = jest.fn(async (key: string) => {
    this.values.delete(key);
  });
}

class Deferred<T> {
  readonly promise: Promise<T>;
  private resolveValue!: (value: T) => void;
  private rejectValue!: (reason?: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolveValue = resolve;
      this.rejectValue = reject;
    });
  }

  resolve(value: T): void {
    this.resolveValue(value);
  }

  reject(reason?: unknown): void {
    this.rejectValue(reason);
  }
}

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createGateway = (
  overrides: Partial<Pick<AuthGateway, "signInWithGoogle" | "signInWithApple" | "signOut">> = {},
) => {
  let observer: AuthObserver | null = null;
  const unsubscribe = jest.fn();
  const signInWithGoogle = jest.fn(overrides.signInWithGoogle ?? (async () => undefined));
  const signInWithApple = jest.fn(overrides.signInWithApple ?? (async () => undefined));
  const signOut = jest.fn(overrides.signOut ?? (async () => undefined));
  const gateway: AuthGateway = {
    observeAuthState: jest.fn((nextObserver) => {
      observer = nextObserver;
      return unsubscribe;
    }),
    signInWithGoogle,
    signInWithApple,
    signOut,
  };

  return {
    gateway,
    signInWithGoogle,
    signInWithApple,
    signOut,
    unsubscribe,
    emit: (user: Parameters<AuthObserver>[0]) => {
      if (observer === null) {
        throw new Error("observer was not registered");
      }
      observer(user);
    },
  };
};

const renderAuth = async (gateway: AuthGateway, storage: KeyValueStorage) => {
  const states: AuthContextValue[] = [];
  const Probe = () => {
    states.push(useAuth());
    return null;
  };

  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <AuthProvider gateway={gateway} storage={storage}>
        <Probe />
      </AuthProvider>,
    );
    await flush();
  });

  return { renderer: renderer!, states };
};

describe("AuthProvider", () => {
  it("registers exactly one auth observer and unsubscribes on unmount", async () => {
    const { gateway, unsubscribe } = createGateway();
    const storage = new MemoryStorage();
    const { renderer } = await renderAuth(gateway, storage);

    await act(async () => {
      await flush();
    });
    act(() => {
      renderer.unmount();
    });

    expect(gateway.observeAuthState).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("restores a saved guest session after observer and storage both settle", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    storage.values.set(
      storageKeys.guestChoice,
      JSON.stringify({ schemaVersion: 1, choice: "guest" }),
    );
    const { states } = await renderAuth(gateway, storage);

    await act(async () => {
      emit(null);
      await flush();
    });

    expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "guest",
      hasChosenGuest: true,
      initializingAuth: false,
      initializingGuestChoice: false,
    }));
  });

  it("falls back to signed out when saved guest choice is corrupt", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    storage.values.set(storageKeys.guestChoice, "{");
    const { states } = await renderAuth(gateway, storage);

    await act(async () => {
      emit(null);
      await flush();
    });

    expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "signedOut",
      hasChosenGuest: false,
      initializingAuth: false,
      initializingGuestChoice: false,
    }));
  });

  it("keeps auth initializing when corrupt storage settles before the observer", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    storage.values.set(storageKeys.guestChoice, "{");
    const { states } = await renderAuth(gateway, storage);

    expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "initializing",
      hasChosenGuest: false,
      initializingAuth: true,
      initializingGuestChoice: false,
    }));

    await act(async () => {
      emit(null);
      await flush();
    });

    expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "signedOut",
      hasChosenGuest: false,
      initializingAuth: false,
      initializingGuestChoice: false,
    }));
  });

  it("ignores and clears a late saved guest choice after an authenticated observer event", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    const guestChoiceRead = new Deferred<string | null>();
    storage.values.set(
      storageKeys.guestChoice,
      JSON.stringify({ schemaVersion: 1, choice: "guest" }),
    );
    storage.getItem.mockImplementationOnce(() => guestChoiceRead.promise);
    const { states } = await renderAuth(gateway, storage);

    await act(async () => {
      emit({ uid: "user-1" });
      await flush();
    });

    expect(storage.removeItem).toHaveBeenCalledWith(storageKeys.guestChoice);

    await act(async () => {
      guestChoiceRead.resolve(JSON.stringify({ schemaVersion: 1, choice: "guest" }));
      await flush();
    });

    expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "authenticated",
      user: expect.objectContaining({ uid: "user-1" }),
      hasChosenGuest: false,
      initializingAuth: false,
      initializingGuestChoice: false,
    }));
    expect(storage.values.has(storageKeys.guestChoice)).toBe(false);
  });

  it("ignores a duplicate Google sign-in press while the first is in flight", async () => {
    const deferred = new Deferred<void>();
    const { gateway, emit, signInWithGoogle } = createGateway({
      signInWithGoogle: () => deferred.promise,
    });
    const storage = new MemoryStorage();
    const { states } = await renderAuth(gateway, storage);

    await act(async () => {
      emit(null);
      await flush();
    });
    let first: Promise<void>;
    await act(async () => {
      first = states.at(-1)!.signInWithGoogle();
      void states.at(-1)!.signInWithGoogle();
      await flush();
    });
    await act(async () => {
      deferred.resolve();
      await first!;
      await flush();
    });

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("does not expose cancellation as an error", async () => {
    const { gateway, emit } = createGateway({
      signInWithGoogle: async () => {
        throw { code: "SIGN_IN_CANCELLED" };
      },
    });
    const storage = new MemoryStorage();
    const { states } = await renderAuth(gateway, storage);

    await act(async () => {
      emit(null);
      await flush();
    });
    await act(async () => {
      await states.at(-1)!.signInWithGoogle();
      await flush();
    });

    expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "signedOut",
      error: null,
      action: "none",
    }));
  });

  it("persists guest choice when continuing as guest", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    const { states } = await renderAuth(gateway, storage);

    await act(async () => {
      emit(null);
      await flush();
    });
    await act(async () => {
      await states.at(-1)!.continueAsGuest();
      await flush();
    });

    expect(JSON.parse(storage.values.get(storageKeys.guestChoice)!)).toEqual({
      schemaVersion: 1,
      choice: "guest",
    });
    expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "guest",
      hasChosenGuest: true,
    }));
  });

  it("clears guest choice when returning to sign in", async () => {
    const { gateway, emit } = createGateway();
    const storage = new MemoryStorage();
    storage.values.set(
      storageKeys.guestChoice,
      JSON.stringify({ schemaVersion: 1, choice: "guest" }),
    );
    const { states } = await renderAuth(gateway, storage);

    await act(async () => {
      emit(null);
      await flush();
    });
    await act(async () => {
      await states.at(-1)!.returnToSignIn();
      await flush();
    });

    expect(storage.values.has(storageKeys.guestChoice)).toBe(false);
    expect(states.at(-1)).toEqual(expect.objectContaining({
      status: "signedOut",
      hasChosenGuest: false,
    }));
  });

  it("clears guest choice and delegates sign-out to the gateway", async () => {
    const { gateway, emit, signOut } = createGateway();
    const storage = new MemoryStorage();
    storage.values.set(
      storageKeys.guestChoice,
      JSON.stringify({ schemaVersion: 1, choice: "guest" }),
    );
    const { states } = await renderAuth(gateway, storage);

    await act(async () => {
      emit({ uid: "user-1" });
      await flush();
    });
    await act(async () => {
      await states.at(-1)!.signOut();
      await flush();
    });

    expect(storage.values.has(storageKeys.guestChoice)).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
