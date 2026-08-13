import {
  MAX_PROGRESS_ID_LIST_LENGTH,
  acknowledgeQuestionIds,
  decodeGuestProgressRecord,
  addPendingQuestionIds,
  decodeProgressCache,
  encodeGuestProgressRecord,
  encodeProgressCache,
  normalizeProgress,
  selectVisibleProgress,
  unionQuestionIds,
} from "@/domain/progress";

describe("progress domain", () => {
  it("normalizes trimmed unique bounded IDs and retains unknown IDs", () => {
    expect(
      normalizeProgress({
        acknowledgedQuestionIds: [" a ", "a", "", "unknown"],
        pendingQuestionIds: ["b", "a", "b", "unknown-2"],
      }),
    ).toEqual({
      acknowledgedQuestionIds: ["a", "unknown"],
      pendingQuestionIds: ["b", "unknown-2"],
    });
  });

  it("drops IDs longer than 128 characters", () => {
    const tooLong = "x".repeat(129);

    expect(
      normalizeProgress({
        acknowledgedQuestionIds: ["a", tooLong],
        pendingQuestionIds: [tooLong, "b"],
      }),
    ).toEqual({
      acknowledgedQuestionIds: ["a"],
      pendingQuestionIds: ["b"],
    });
  });

  it("limits normalized progress to 1000 total IDs across acknowledged and pending lists", () => {
    const acknowledgedQuestionIds = Array.from(
      { length: MAX_PROGRESS_ID_LIST_LENGTH },
      (_, index) => `a-${index}`,
    );

    expect(
      normalizeProgress({
        acknowledgedQuestionIds,
        pendingQuestionIds: ["pending"],
      }),
    ).toEqual({
      acknowledgedQuestionIds,
      pendingQuestionIds: [],
    });
  });

  it("bounds only visible selectors to known IDs", () => {
    expect(
      selectVisibleProgress(
        {
          acknowledgedQuestionIds: ["a", "unknown"],
          pendingQuestionIds: ["b", "unknown-2"],
        },
        ["a", "b"],
      ),
    ).toEqual({
      acknowledgedQuestionIds: ["a"],
      pendingQuestionIds: ["b"],
    });
  });

  it("uses idempotent union helpers", () => {
    expect(unionQuestionIds(["a", "b"], ["b", "c", ""])).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(
      addPendingQuestionIds(
        { acknowledgedQuestionIds: ["a"], pendingQuestionIds: ["b"] },
        ["b", "c", "a"],
      ),
    ).toEqual({
      acknowledgedQuestionIds: ["a"],
      pendingQuestionIds: ["b", "c"],
    });
  });

  it("acknowledges before clearing and can be repeated safely", () => {
    const progress = {
      acknowledgedQuestionIds: ["a"],
      pendingQuestionIds: ["b", "c"],
    };
    const acknowledged = acknowledgeQuestionIds(progress, ["b", "b"]);

    expect(acknowledged).toEqual({
      acknowledgedQuestionIds: ["a", "b"],
      pendingQuestionIds: ["c"],
    });
    expect(acknowledgeQuestionIds(acknowledged, ["b"])).toEqual(acknowledged);
  });

  it("strictly decodes schema v1 progress caches", () => {
    const cache = encodeProgressCache({
      acknowledgedQuestionIds: ["a", "a"],
      pendingQuestionIds: ["b", "a"],
    });

    expect(cache).toEqual({
      schemaVersion: 1,
      acknowledgedQuestionIds: ["a"],
      pendingQuestionIds: ["b"],
    });
    expect(decodeProgressCache(cache)).toEqual(cache);
    expect(() =>
      decodeProgressCache({
        schemaVersion: 1,
        acknowledgedQuestionIds: [],
        pendingQuestionIds: [],
        extra: true,
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeProgressCache({
        schemaVersion: 1,
        acknowledgedQuestionIds: [1],
        pendingQuestionIds: [],
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeProgressCache({
        schemaVersion: 1,
        acknowledgedQuestionIds: ["x".repeat(129)],
        pendingQuestionIds: [],
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeProgressCache({
        schemaVersion: 1,
        acknowledgedQuestionIds: Array.from(
          { length: MAX_PROGRESS_ID_LIST_LENGTH },
          (_, index) => `a-${index}`,
        ),
        pendingQuestionIds: ["overflow"],
      }),
    ).toThrow(TypeError);
  });

  it("strictly encodes and decodes guest progress records", () => {
    const updatedAt = "2026-08-13T00:00:00.000Z";
    const record = encodeGuestProgressRecord([" a ", "a", "unknown"], updatedAt);

    expect(record).toEqual({
      schemaVersion: 1,
      solvedQuestionIds: ["a", "unknown"],
      updatedAt,
    });
    expect(decodeGuestProgressRecord(record)).toEqual(record);
    expect(() =>
      decodeGuestProgressRecord({
        schemaVersion: 1,
        solvedQuestionIds: [],
        updatedAt,
        extra: true,
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeGuestProgressRecord({
        schemaVersion: 1,
        solvedQuestionIds: [],
        updatedAt: "bad",
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeGuestProgressRecord({
        schemaVersion: 1,
        solvedQuestionIds: ["x".repeat(129)],
        updatedAt,
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeGuestProgressRecord({
        schemaVersion: 1,
        solvedQuestionIds: Array.from(
          { length: MAX_PROGRESS_ID_LIST_LENGTH + 1 },
          (_, index) => `id-${index}`,
        ),
        updatedAt,
      }),
    ).toThrow(TypeError);
  });
});
