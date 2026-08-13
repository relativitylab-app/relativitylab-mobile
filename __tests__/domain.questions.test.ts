import {
  decodeQuestion,
  decodeQuestionCache,
  decodeQuestions,
  encodeQuestionCache,
  isExactCorrectAnswer,
  parseUserAnswer,
} from "@/domain/questions";

describe("question domain", () => {
  it("decodes exact {number, question, answer} payloads with numeric answers or numeric strings", () => {
    expect(
      decodeQuestion(" a ", {
        number: 2,
        question: " What is gamma? ",
        answer: "3.5",
      }),
    ).toEqual({
      id: "a",
      number: 2,
      question: "What is gamma?",
      answer: 3.5,
    });
  });

  it("rejects empty question IDs and prompts", () => {
    expect(() =>
      decodeQuestion("   ", {
        number: 1,
        question: "Valid",
        answer: 1,
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeQuestion("a", {
        number: 1,
        question: "   ",
        answer: 1,
      }),
    ).toThrow(TypeError);
  });

  it("rejects non-finite and non-numeric question fields", () => {
    expect(() =>
      decodeQuestion("a", {
        number: "NaN",
        question: "Bad",
        answer: 1,
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeQuestion("a", {
        number: 1,
        question: "Bad",
        answer: Infinity,
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeQuestion("a", {
        number: 1,
        question: 42,
        answer: 1,
      }),
    ).toThrow(TypeError);
  });

  it("sorts decoded questions by number and then id", () => {
    const result = decodeQuestions([
        { id: "b", data: { number: 2, question: "B", answer: 2 } },
        { id: "c", data: { number: 1, question: "C", answer: 3 } },
        { id: "a", data: { number: 2, question: "A", answer: 1 } },
      ]);

    expect(result.questions.map((question) => question.id)).toEqual(["c", "a", "b"]);
    expect(result.invalidCount).toBe(0);
  });

  it("reports malformed batch entries without throwing away the full snapshot", () => {
    const result = decodeQuestions([
      { id: "b", data: { number: 2, question: "B", answer: 2 } },
      { id: "", data: { number: 1, question: "bad", answer: 1 } },
      { id: "c", data: { number: 3, question: "", answer: 3 } },
    ]);

    expect(result).toEqual({
      questions: [{ id: "b", number: 2, question: "B", answer: 2 }],
      invalidCount: 2,
    });
  });

  it("parses user answers from trimmed finite strings and normalizes negative zero", () => {
    expect(parseUserAnswer(" 3.5 ")).toBe(3.5);
    expect(parseUserAnswer(" -0 ")).toBe(0);
    expect(parseUserAnswer("")).toBeNull();
    expect(parseUserAnswer("Infinity")).toBeNull();
    expect(parseUserAnswer(1)).toBeNull();
  });

  it("uses exact parsed Number comparison without tolerance", () => {
    expect(isExactCorrectAnswer(0.3, "0.3")).toBe(true);
    expect(isExactCorrectAnswer(0, "-0")).toBe(true);
    expect(isExactCorrectAnswer(0.3, String(0.1 + 0.2))).toBe(false);
    expect(isExactCorrectAnswer(NaN, NaN)).toBe(false);
  });

  it("encodes and strictly decodes schema v1 question caches", () => {
    const cachedAt = "2026-08-13T00:00:00.000Z";
    const cache = encodeQuestionCache([
      { id: "a", number: 1, question: "A", answer: 1 },
    ], cachedAt);

    expect(decodeQuestionCache(cache)).toEqual(cache);
    expect(() =>
      decodeQuestionCache({ schemaVersion: 2, questions: [] }),
    ).toThrow(TypeError);
    expect(() =>
      decodeQuestionCache({ schemaVersion: 1, cachedAt, questions: [], extra: true }),
    ).toThrow(TypeError);
    expect(() =>
      decodeQuestionCache({ schemaVersion: 1, cachedAt: "not-date", questions: [] }),
    ).toThrow(TypeError);
    expect(() =>
      decodeQuestionCache({ schemaVersion: 1, cachedAt: "2026-13-99", questions: [] }),
    ).toThrow(TypeError);
    expect(() =>
      decodeQuestionCache({
        schemaVersion: 1,
        cachedAt,
        questions: [{ id: "a", number: 1, question: "A", answer: 1, extra: true }],
      }),
    ).toThrow(TypeError);
  });
});
