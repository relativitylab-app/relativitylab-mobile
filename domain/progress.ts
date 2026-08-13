export interface ProgressState {
  readonly acknowledgedQuestionIds: readonly string[];
  readonly pendingQuestionIds: readonly string[];
}

export interface ProgressCacheV1 {
  readonly schemaVersion: 1;
  readonly acknowledgedQuestionIds: readonly string[];
  readonly pendingQuestionIds: readonly string[];
}

export interface GuestProgressRecordV1 {
  readonly schemaVersion: 1;
  readonly solvedQuestionIds: readonly string[];
  readonly updatedAt: string;
}

export const MAX_PROGRESS_ID_LENGTH = 128;
export const MAX_PROGRESS_ID_LIST_LENGTH = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidProgressId = (id: unknown): id is string =>
  typeof id === "string" &&
  id !== "" &&
  id.trim() === id &&
  id.length <= MAX_PROGRESS_ID_LENGTH;

const assertStrictIdList = (
  ids: readonly unknown[],
  field: string,
): readonly string[] => {
  if (ids.length > MAX_PROGRESS_ID_LIST_LENGTH) {
    throw new TypeError(`${field} exceeds maximum length`);
  }

  if (!ids.every(isValidProgressId)) {
    throw new TypeError(`${field} contains invalid IDs`);
  }

  return ids;
};

const assertStrictProgressListTotal = (
  acknowledgedQuestionIds: readonly unknown[],
  pendingQuestionIds: readonly unknown[],
): void => {
  if (
    acknowledgedQuestionIds.length + pendingQuestionIds.length >
    MAX_PROGRESS_ID_LIST_LENGTH
  ) {
    throw new TypeError("progress ID list exceeds maximum length");
  }
};

const uniqueBoundedIds = (
  ids: readonly unknown[],
  maxLength = MAX_PROGRESS_ID_LIST_LENGTH,
): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  ids.forEach((id) => {
    if (normalized.length >= maxLength) {
      return;
    }

    if (typeof id !== "string") {
      return;
    }

    const trimmedId = id.trim();

    if (
      trimmedId === "" ||
      trimmedId.length > MAX_PROGRESS_ID_LENGTH ||
      seen.has(trimmedId)
    ) {
      return;
    }

    seen.add(trimmedId);
    normalized.push(trimmedId);
  });

  return normalized;
};

export const normalizeProgress = (
  progress: ProgressState,
): ProgressState => {
  const acknowledgedQuestionIds = uniqueBoundedIds(
    progress.acknowledgedQuestionIds,
  );
  const acknowledgedSet = new Set(acknowledgedQuestionIds);
  const pendingMaxLength =
    MAX_PROGRESS_ID_LIST_LENGTH - acknowledgedQuestionIds.length;
  const pendingQuestionIds = uniqueBoundedIds(
    progress.pendingQuestionIds,
    pendingMaxLength,
  ).filter((id) => !acknowledgedSet.has(id));

  return {
    acknowledgedQuestionIds,
    pendingQuestionIds,
  };
};

export const unionQuestionIds = (
  currentIds: readonly string[],
  nextIds: readonly string[],
): string[] =>
  [
    ...normalizeProgress(
    {
      acknowledgedQuestionIds: [],
      pendingQuestionIds: [...currentIds, ...nextIds],
    },
    ).pendingQuestionIds,
  ];

export const addPendingQuestionIds = (
  progress: ProgressState,
  questionIds: readonly string[],
): ProgressState =>
  normalizeProgress(
    {
      acknowledgedQuestionIds: progress.acknowledgedQuestionIds,
      pendingQuestionIds: [...progress.pendingQuestionIds, ...questionIds],
    },
  );

export const acknowledgeQuestionIds = (
  progress: ProgressState,
  questionIds: readonly string[],
): ProgressState => {
  const normalizedQuestionIds = uniqueBoundedIds(questionIds);

  return normalizeProgress(
    {
      acknowledgedQuestionIds: [
        ...progress.acknowledgedQuestionIds,
        ...normalizedQuestionIds,
      ],
      pendingQuestionIds: progress.pendingQuestionIds.filter(
        (id) => !normalizedQuestionIds.includes(id),
      ),
    },
  );
};

export const selectVisibleProgress = (
  progress: ProgressState,
  visibleQuestionIds: readonly string[],
): ProgressState => {
  const visibleIds = new Set(uniqueBoundedIds(visibleQuestionIds));

  return {
    acknowledgedQuestionIds: progress.acknowledgedQuestionIds.filter((id) =>
      visibleIds.has(id),
    ),
    pendingQuestionIds: progress.pendingQuestionIds.filter((id) =>
      visibleIds.has(id),
    ),
  };
};

export const encodeProgressCache = (
  progress: ProgressState,
): ProgressCacheV1 => ({
  schemaVersion: 1,
  ...normalizeProgress(progress),
});

export const decodeProgressCache = (value: unknown): ProgressCacheV1 => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.acknowledgedQuestionIds) ||
    !Array.isArray(value.pendingQuestionIds) ||
    Object.keys(value).length !== 3
  ) {
    throw new TypeError("invalid progress cache schema");
  }

  assertStrictIdList(
    value.acknowledgedQuestionIds,
    "acknowledgedQuestionIds",
  );
  assertStrictIdList(value.pendingQuestionIds, "pendingQuestionIds");
  assertStrictProgressListTotal(
    value.acknowledgedQuestionIds,
    value.pendingQuestionIds,
  );

  return {
    schemaVersion: 1,
    ...normalizeProgress({
      acknowledgedQuestionIds: value.acknowledgedQuestionIds,
      pendingQuestionIds: value.pendingQuestionIds,
    }),
  };
};

const decodeIsoTimestamp = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value === "") {
    throw new TypeError(`${field} must be an ISO string`);
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(`${field} must be an ISO string`);
  }

  return value;
};

export const encodeGuestProgressRecord = (
  solvedQuestionIds: readonly string[],
  updatedAt: string,
): GuestProgressRecordV1 => ({
  schemaVersion: 1,
  solvedQuestionIds: uniqueBoundedIds(solvedQuestionIds),
  updatedAt: decodeIsoTimestamp(updatedAt, "updatedAt"),
});

export const decodeGuestProgressRecord = (
  value: unknown,
): GuestProgressRecordV1 => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.solvedQuestionIds) ||
    typeof value.updatedAt !== "string" ||
    Object.keys(value).length !== 3
  ) {
    throw new TypeError("invalid guest progress schema");
  }

  assertStrictIdList(value.solvedQuestionIds, "solvedQuestionIds");

  return encodeGuestProgressRecord(value.solvedQuestionIds, value.updatedAt);
};
