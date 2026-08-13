export interface Question {
  readonly id: string;
  readonly number: number;
  readonly question: string;
  readonly answer: number;
}

export interface QuestionCacheV1 {
  readonly schemaVersion: 1;
  readonly cachedAt: string;
  readonly questions: readonly Question[];
}

export interface DecodeQuestionsResult {
  readonly questions: readonly Question[];
  readonly invalidCount: number;
}

interface QuestionInput {
  readonly id?: unknown;
  readonly number?: unknown;
  readonly question?: unknown;
  readonly answer?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const decodeFiniteNumber = (field: string, value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new TypeError(`${field} must be a finite number`);
};

export const decodeQuestion = (id: string, input: QuestionInput): Question => {
  if (!isRecord(input)) {
    throw new TypeError("question payload must be an object");
  }

  const normalizedId = id.trim();

  if (normalizedId === "") {
    throw new TypeError("id must be a non-empty string");
  }

  if (typeof input.question !== "string" || input.question.trim() === "") {
    throw new TypeError("question must be a non-empty string");
  }

  return {
    id: normalizedId,
    number: decodeFiniteNumber("number", input.number),
    question: input.question.trim(),
    answer: decodeFiniteNumber("answer", input.answer),
  };
};

export const decodeQuestions = (
  entries: readonly { readonly id: string; readonly data: QuestionInput }[],
): DecodeQuestionsResult => {
  const questions: Question[] = [];
  let invalidCount = 0;

  entries.forEach((entry) => {
    try {
      questions.push(decodeQuestion(entry.id, entry.data));
    } catch {
      invalidCount += 1;
    }
  });

  questions.sort(
    (left, right) => left.number - right.number || left.id.localeCompare(right.id),
  );

  return { questions, invalidCount };
};

export const parseUserAnswer = (value: unknown): number | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Object.is(parsed, -0) ? 0 : parsed;
};

export const isExactCorrectAnswer = (
  expectedAnswer: number,
  submittedAnswer: unknown,
): boolean => {
  const parsedAnswer = parseUserAnswer(submittedAnswer);

  if (!Number.isFinite(expectedAnswer) || parsedAnswer === null) {
    return false;
  }

  return parsedAnswer === Number(expectedAnswer);
};

const isQuestion = (value: unknown): value is Question =>
  isRecord(value) &&
  Object.keys(value).length === 4 &&
  typeof value.id === "string" &&
  value.id.trim() === value.id &&
  value.id !== "" &&
  typeof value.question === "string" &&
  value.question.trim() === value.question &&
  value.question !== "" &&
  typeof value.number === "number" &&
  Number.isFinite(value.number) &&
  typeof value.answer === "number" &&
  Number.isFinite(value.answer);

export const encodeQuestionCache = (
  questions: readonly Question[],
  cachedAt: string,
): QuestionCacheV1 => ({
  schemaVersion: 1,
  cachedAt: decodeIsoTimestamp(cachedAt),
  questions: questions.map((question) => {
    if (!isQuestion(question)) {
      throw new TypeError("question cache can only store decoded questions");
    }

    return { ...question };
  }),
});

const decodeIsoTimestamp = (value: unknown): string => {
  if (typeof value !== "string" || value === "") {
    throw new TypeError("cachedAt must be an ISO string");
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError("cachedAt must be an ISO string");
  }

  return value;
};

export const decodeQuestionCache = (value: unknown): QuestionCacheV1 => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.cachedAt !== "string" ||
    !Array.isArray(value.questions) ||
    Object.keys(value).length !== 3
  ) {
    throw new TypeError("invalid question cache schema");
  }

  const cachedAt = decodeIsoTimestamp(value.cachedAt);

  const questions = value.questions.map((question) => {
    if (!isQuestion(question)) {
      throw new TypeError("invalid cached question");
    }

    return { ...question };
  });

  return encodeQuestionCache(questions, cachedAt);
};
