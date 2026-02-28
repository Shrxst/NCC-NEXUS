const { scoreAttempt } = require("../src/modules/quiz/service/quiz.service");

describe("quiz scoreAttempt", () => {
  it("computes summary and breakdown with negative marking", () => {
    const questionRows = [
      {
        question_id: "00000000-0000-0000-0000-000000000001",
        question_text: "Q1",
        option_a: "A1",
        option_b: "B1",
        option_c: "C1",
        option_d: "D1",
        correct_option: "A",
        explanation: "E1",
      },
      {
        question_id: "00000000-0000-0000-0000-000000000002",
        question_text: "Q2",
        option_a: "A2",
        option_b: "B2",
        option_c: "C2",
        option_d: "D2",
        correct_option: "D",
        explanation: "E2",
      },
      {
        question_id: "00000000-0000-0000-0000-000000000003",
        question_text: "Q3",
        option_a: "A3",
        option_b: "B3",
        option_c: "C3",
        option_d: "D3",
        correct_option: "C",
        explanation: "E3",
      },
    ];

    const answersMap = new Map([
      ["00000000-0000-0000-0000-000000000001", "A"],
      ["00000000-0000-0000-0000-000000000002", "B"],
    ]);

    const result = scoreAttempt({
      questionRows,
      answersMap,
      durationSeconds: 600,
      startedAt: new Date("2026-02-28T10:00:00.000Z"),
      submittedAt: new Date("2026-02-28T10:03:30.000Z"),
    });

    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(1);
    expect(result.unattemptedCount).toBe(1);
    expect(result.negativeMarks).toBe(0.25);
    expect(result.finalScore).toBe(0.75);
    expect(result.accuracyPercent).toBe(33.33);
    expect(result.timeTakenSeconds).toBe(210);
    expect(result.detailedBreakdown).toHaveLength(3);
  });
});
