import {
  ProgressRepositoryDriver,
  createProgressRepository,
} from "@/infrastructure/firebase/progressRepository";

const createDriver = () => {
  let observer:
    | ((snapshot: {
        readonly data: unknown;
        readonly fromCache: boolean;
        readonly hasPendingWrites: boolean;
      }) => void)
    | null = null;
  const unsubscribe = jest.fn();
  const mergeAnswered = jest.fn(async () => undefined);
  const awaitPendingWrites = jest.fn(async () => undefined);
  const driver: ProgressRepositoryDriver = {
    observeProfile: jest.fn((_uid, nextObserver) => {
      observer = nextObserver;
      return unsubscribe;
    }),
    mergeAnswered,
    awaitPendingWrites,
  };

  return {
    driver,
    mergeAnswered,
    awaitPendingWrites,
    unsubscribe,
    emit: (
      data: unknown,
      metadata = { fromCache: false, hasPendingWrites: false },
    ) => observer?.({ data, ...metadata }),
  };
};

describe("progress repository", () => {
  it("observes only the UID provided by the authenticated caller", () => {
    const { driver, emit, unsubscribe } = createDriver();
    const repository = createProgressRepository(driver);
    const observer = jest.fn();

    const stop = repository.observeProfile("current-user", observer, jest.fn());
    emit(
      { answered: ["q2", "q1", "q2"] },
      { fromCache: true, hasPendingWrites: true },
    );
    stop();

    expect(driver.observeProfile).toHaveBeenCalledWith(
      "current-user",
      expect.any(Function),
      expect.any(Function),
    );
    expect(observer).toHaveBeenCalledWith({
      solvedQuestionIds: ["q2", "q1"],
      fromCache: true,
      hasPendingWrites: true,
      dataError: false,
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a missing profile from malformed remote progress", () => {
    const { driver, emit } = createDriver();
    const repository = createProgressRepository(driver);
    const observer = jest.fn();

    repository.observeProfile("user-1", observer, jest.fn());
    emit(undefined);
    emit({ answered: "q1" });

    expect(observer).toHaveBeenNthCalledWith(1, {
      solvedQuestionIds: [],
      fromCache: false,
      hasPendingWrites: false,
      dataError: false,
    });
    expect(observer).toHaveBeenNthCalledWith(2, {
      solvedQuestionIds: [],
      fromCache: false,
      hasPendingWrites: false,
      dataError: true,
    });
  });

  it("rejects mixed and non-canonical remote IDs instead of changing identity", () => {
    const { driver, emit } = createDriver();
    const repository = createProgressRepository(driver);
    const observer = jest.fn();

    repository.observeProfile("user-1", observer, jest.fn());
    emit({ answered: ["q1", " q2 ", 3] });

    expect(observer).toHaveBeenCalledWith({
      solvedQuestionIds: [],
      fromCache: false,
      hasPendingWrites: false,
      dataError: true,
    });
  });

  it("normalizes one merge-only write and does not wait for backend acknowledgement", async () => {
    const { driver, mergeAnswered, awaitPendingWrites } = createDriver();
    const repository = createProgressRepository(driver);

    await repository.unionSolvedQuestionIds("user-1", ["q1", "q1", "q2"]);

    expect(mergeAnswered).toHaveBeenCalledWith("user-1", ["q1", "q2"]);
    expect(awaitPendingWrites).not.toHaveBeenCalled();
  });

  it("skips empty writes and exposes an explicit acknowledgement boundary", async () => {
    const { driver, mergeAnswered, awaitPendingWrites } = createDriver();
    const repository = createProgressRepository(driver);

    await repository.unionSolvedQuestionIds("user-1", ["", " "]);
    await repository.awaitPendingWrites();

    expect(mergeAnswered).not.toHaveBeenCalled();
    expect(awaitPendingWrites).toHaveBeenCalledTimes(1);
  });
});
