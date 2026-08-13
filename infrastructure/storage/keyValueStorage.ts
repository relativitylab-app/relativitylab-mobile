import {
  GuestProgressRecordV1,
  ProgressState,
  decodeGuestProgressRecord,
  decodeProgressCache,
  encodeGuestProgressRecord,
  encodeProgressCache,
} from "@/domain/progress";
import {
  Question,
  QuestionCacheV1,
  decodeQuestionCache,
  encodeQuestionCache,
} from "@/domain/questions";

export interface KeyValueStorage {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem: (key: string) => Promise<void>;
}

export type GuestChoice = "guest" | "account";

export interface PendingRecord {
  readonly id: string;
  readonly questionId: string;
  readonly answer: number;
  readonly createdAt: number;
}

interface PendingRecordsCacheV1 {
  readonly schemaVersion: 1;
  readonly records: readonly PendingRecord[];
}

const STORAGE_PREFIX = "relativitylab:v1";
const MAX_PENDING_RECORD_ID_LENGTH = 128;
const MAX_PENDING_RECORDS = 1000;

export const storageKeys = {
  guestChoice: `${STORAGE_PREFIX}:guest-choice`,
  guestProgress: `${STORAGE_PREFIX}:guest-progress`,
  progress: `${STORAGE_PREFIX}:progress`,
  questionCache: `${STORAGE_PREFIX}:question-cache`,
  pendingRecords: `${STORAGE_PREFIX}:pending-records`,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const safeReadJson = async <T>(
  storage: KeyValueStorage,
  key: string,
  decode: (value: unknown) => T,
): Promise<T | null> => {
  const raw = await storage.getItem(key);

  if (raw === null) {
    return null;
  }

  try {
    return decode(JSON.parse(raw));
  } catch {
    await storage.removeItem(key);
    return null;
  }
};

const writeJson = async (
  storage: KeyValueStorage,
  key: string,
  value: unknown,
): Promise<void> => {
  await storage.setItem(key, JSON.stringify(value));
};

export const saveGuestChoice = async (
  storage: KeyValueStorage,
  choice: GuestChoice,
): Promise<void> => {
  await writeJson(storage, storageKeys.guestChoice, {
    schemaVersion: 1,
    choice,
  });
};

export const loadGuestChoice = async (
  storage: KeyValueStorage,
): Promise<GuestChoice | null> =>
  safeReadJson(storage, storageKeys.guestChoice, (value) => {
    if (
      !isRecord(value) ||
      value.schemaVersion !== 1 ||
      (value.choice !== "guest" && value.choice !== "account") ||
      Object.keys(value).length !== 2
    ) {
      throw new TypeError("invalid guest choice");
    }

    return value.choice;
  });

export const clearGuestChoice = async (
  storage: KeyValueStorage,
): Promise<void> => {
  await storage.removeItem(storageKeys.guestChoice);
};

export const saveGuestProgress = async (
  storage: KeyValueStorage,
  solvedQuestionIds: readonly string[],
  updatedAt: string,
): Promise<void> => {
  await writeJson(
    storage,
    storageKeys.guestProgress,
    encodeGuestProgressRecord(solvedQuestionIds, updatedAt),
  );
};

export const loadGuestProgress = async (
  storage: KeyValueStorage,
): Promise<GuestProgressRecordV1 | null> =>
  safeReadJson(storage, storageKeys.guestProgress, decodeGuestProgressRecord);

export const clearGuestProgress = async (
  storage: KeyValueStorage,
): Promise<void> => {
  await storage.removeItem(storageKeys.guestProgress);
};

export const saveProgress = async (
  storage: KeyValueStorage,
  progress: ProgressState,
): Promise<void> => {
  await writeJson(storage, storageKeys.progress, encodeProgressCache(progress));
};

export const loadProgress = async (
  storage: KeyValueStorage,
): Promise<ProgressState | null> => {
  const cache = await safeReadJson(
    storage,
    storageKeys.progress,
    decodeProgressCache,
  );

  return cache === null
    ? null
    : {
        acknowledgedQuestionIds: cache.acknowledgedQuestionIds,
        pendingQuestionIds: cache.pendingQuestionIds,
      };
};

export const clearProgress = async (storage: KeyValueStorage): Promise<void> => {
  await storage.removeItem(storageKeys.progress);
};

export const saveQuestionCache = async (
  storage: KeyValueStorage,
  questions: readonly Question[],
  cachedAt: string,
): Promise<void> => {
  await writeJson(
    storage,
    storageKeys.questionCache,
    encodeQuestionCache(questions, cachedAt),
  );
};

export const loadQuestionCache = async (
  storage: KeyValueStorage,
): Promise<QuestionCacheV1 | null> =>
  safeReadJson(
    storage,
    storageKeys.questionCache,
    decodeQuestionCache,
  );

export const clearQuestionCache = async (
  storage: KeyValueStorage,
): Promise<void> => {
  await storage.removeItem(storageKeys.questionCache);
};

const isValidPendingRecordId = (value: unknown): value is string =>
  typeof value === "string" &&
  value !== "" &&
  value.trim() === value &&
  value.length <= MAX_PENDING_RECORD_ID_LENGTH;

const isPendingRecord = (value: unknown): value is PendingRecord =>
  isRecord(value) &&
  Object.keys(value).length === 4 &&
  isValidPendingRecordId(value.id) &&
  isValidPendingRecordId(value.questionId) &&
  typeof value.answer === "number" &&
  Number.isFinite(value.answer) &&
  typeof value.createdAt === "number" &&
  Number.isFinite(value.createdAt);

const encodePendingRecords = (
  records: readonly PendingRecord[],
): PendingRecordsCacheV1 => ({
  schemaVersion: 1,
  records: records.map((record) => {
    if (records.length > MAX_PENDING_RECORDS) {
      throw new TypeError("too many pending records");
    }

    if (!isPendingRecord(record)) {
      throw new TypeError("invalid pending record");
    }

    return { ...record };
  }),
});

const decodePendingRecords = (value: unknown): PendingRecordsCacheV1 => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.records) ||
    value.records.length > MAX_PENDING_RECORDS ||
    Object.keys(value).length !== 2
  ) {
    throw new TypeError("invalid pending records schema");
  }

  return encodePendingRecords(value.records);
};

export const unionPendingRecords = (
  currentRecords: readonly PendingRecord[],
  nextRecords: readonly PendingRecord[],
): PendingRecord[] => {
  const recordsById = new Map<string, PendingRecord>();

  [...currentRecords, ...nextRecords].forEach((record) => {
    if (
      recordsById.size < MAX_PENDING_RECORDS &&
      isPendingRecord(record) &&
      !recordsById.has(record.id)
    ) {
      recordsById.set(record.id, { ...record });
    }
  });

  return [...recordsById.values()];
};

export const savePendingRecords = async (
  storage: KeyValueStorage,
  records: readonly PendingRecord[],
): Promise<void> => {
  await writeJson(
    storage,
    storageKeys.pendingRecords,
    encodePendingRecords(records),
  );
};

export const loadPendingRecords = async (
  storage: KeyValueStorage,
): Promise<readonly PendingRecord[] | null> => {
  const cache = await safeReadJson(
    storage,
    storageKeys.pendingRecords,
    decodePendingRecords,
  );

  return cache?.records ?? null;
};

export const addPendingRecords = async (
  storage: KeyValueStorage,
  records: readonly PendingRecord[],
): Promise<readonly PendingRecord[]> => {
  const currentRecords = (await loadPendingRecords(storage)) ?? [];
  const nextRecords = unionPendingRecords(currentRecords, records);

  await savePendingRecords(storage, nextRecords);

  return nextRecords;
};

export const acknowledgePendingRecords = async (
  storage: KeyValueStorage,
  acknowledgedRecordIds: readonly string[],
): Promise<readonly PendingRecord[]> => {
  const acknowledgedIds = new Set(acknowledgedRecordIds);
  const currentRecords = (await loadPendingRecords(storage)) ?? [];
  const nextRecords = currentRecords.filter(
    (record) => !acknowledgedIds.has(record.id),
  );

  await savePendingRecords(storage, nextRecords);

  return nextRecords;
};

export const clearPendingRecords = async (
  storage: KeyValueStorage,
): Promise<void> => {
  await storage.removeItem(storageKeys.pendingRecords);
};
