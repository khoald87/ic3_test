import { describe, it, expect } from 'vitest';
import { calculateScore, isAnswerCorrect } from '../../src/scoring.js';

/**
 * Helper: tạo câu hỏi mẫu
 */
function makeQuestion(overrides = {}) {
  return {
    id: 'q1',
    q: 'Câu hỏi?',
    type: 'single-choice',
    options: ['A', 'B', 'C', 'D'],
    correct: 2,
    explanation: 'Giải thích',
    difficulty: 'dễ',
    domain: 'hardware',
    module: 'module_1',
    ...overrides
  };
}

describe('isAnswerCorrect', () => {
  it('single-choice: đúng khi selectedAnswer === correct', () => {
    expect(isAnswerCorrect(2, 2, 'single-choice')).toBe(true);
  });

  it('single-choice: sai khi selectedAnswer !== correct', () => {
    expect(isAnswerCorrect(0, 2, 'single-choice')).toBe(false);
  });

  it('true-false: đúng khi selectedAnswer === correct', () => {
    expect(isAnswerCorrect(1, 1, 'true-false')).toBe(true);
  });

  it('true-false: sai khi selectedAnswer !== correct', () => {
    expect(isAnswerCorrect(0, 1, 'true-false')).toBe(false);
  });

  it('multiple-choice: đúng khi cùng phần tử, khác thứ tự', () => {
    expect(isAnswerCorrect([2, 0], [0, 2], 'multiple-choice')).toBe(true);
  });

  it('multiple-choice: sai khi thiếu phần tử', () => {
    expect(isAnswerCorrect([0], [0, 2], 'multiple-choice')).toBe(false);
  });

  it('multiple-choice: sai khi thừa phần tử', () => {
    expect(isAnswerCorrect([0, 1, 2], [0, 2], 'multiple-choice')).toBe(false);
  });

  it('drag-drop: đúng khi cùng thứ tự', () => {
    expect(isAnswerCorrect([0, 1, 2, 3], [0, 1, 2, 3], 'drag-drop')).toBe(true);
  });

  it('drag-drop: sai khi khác thứ tự', () => {
    expect(isAnswerCorrect([1, 0, 2, 3], [0, 1, 2, 3], 'drag-drop')).toBe(false);
  });

  it('null answer luôn sai', () => {
    expect(isAnswerCorrect(null, 2, 'single-choice')).toBe(false);
    expect(isAnswerCorrect(null, [0, 1], 'multiple-choice')).toBe(false);
  });

  it('undefined answer luôn sai', () => {
    expect(isAnswerCorrect(undefined, 1, 'true-false')).toBe(false);
  });
});

describe('calculateScore', () => {
  it('tính điểm đúng cho bài thi toàn đúng', () => {
    const questions = [
      makeQuestion({ id: 'q1', correct: 2, domain: 'hardware' }),
      makeQuestion({ id: 'q2', correct: 0, domain: 'software' }),
      makeQuestion({ id: 'q3', correct: 1, domain: 'networking' })
    ];
    const answers = [
      { questionId: 'q1', selectedAnswer: 2 },
      { questionId: 'q2', selectedAnswer: 0 },
      { questionId: 'q3', selectedAnswer: 1 }
    ];

    const result = calculateScore(answers, questions);
    expect(result.totalScore).toBe(1000);
    expect(result.passed).toBe(true);
    expect(result.correctCount).toBe(3);
    expect(result.totalQuestions).toBe(3);
  });

  it('tính điểm đúng cho bài thi toàn sai', () => {
    const questions = [
      makeQuestion({ id: 'q1', correct: 2, domain: 'hardware' }),
      makeQuestion({ id: 'q2', correct: 0, domain: 'software' })
    ];
    const answers = [
      { questionId: 'q1', selectedAnswer: 0 },
      { questionId: 'q2', selectedAnswer: 1 }
    ];

    const result = calculateScore(answers, questions);
    expect(result.totalScore).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.correctCount).toBe(0);
  });

  it('totalScore = Math.round((correctCount / totalQuestions) * 1000)', () => {
    const questions = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ id: `q${i}`, correct: 0, domain: ['hardware', 'software', 'networking'][i % 3] })
    );
    // 7 đúng, 3 sai → 700 → passed
    const answers = questions.map((q, i) => ({
      questionId: q.id,
      selectedAnswer: i < 7 ? 0 : 1
    }));

    const result = calculateScore(answers, questions);
    expect(result.totalScore).toBe(700);
    expect(result.passed).toBe(true);
    expect(result.correctCount).toBe(7);
  });

  it('passed = false khi điểm < 700', () => {
    const questions = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ id: `q${i}`, correct: 0, domain: ['hardware', 'software', 'networking'][i % 3] })
    );
    // 6 đúng → 600 → not passed
    const answers = questions.map((q, i) => ({
      questionId: q.id,
      selectedAnswer: i < 6 ? 0 : 1
    }));

    const result = calculateScore(answers, questions);
    expect(result.totalScore).toBe(600);
    expect(result.passed).toBe(false);
  });

  it('tính domainScores chính xác', () => {
    const questions = [
      makeQuestion({ id: 'q1', correct: 0, domain: 'hardware' }),
      makeQuestion({ id: 'q2', correct: 0, domain: 'hardware' }),
      makeQuestion({ id: 'q3', correct: 0, domain: 'software' }),
      makeQuestion({ id: 'q4', correct: 0, domain: 'networking' }),
      makeQuestion({ id: 'q5', correct: 0, domain: 'networking' })
    ];
    const answers = [
      { questionId: 'q1', selectedAnswer: 0 },  // đúng - hardware
      { questionId: 'q2', selectedAnswer: 1 },  // sai - hardware
      { questionId: 'q3', selectedAnswer: 0 },  // đúng - software
      { questionId: 'q4', selectedAnswer: 0 },  // đúng - networking
      { questionId: 'q5', selectedAnswer: 1 }   // sai - networking
    ];

    const result = calculateScore(answers, questions);
    expect(result.domainScores.hardware).toEqual({ correct: 1, total: 2 });
    expect(result.domainScores.software).toEqual({ correct: 1, total: 1 });
    expect(result.domainScores.networking).toEqual({ correct: 1, total: 2 });
  });

  it('trả về chi tiết từng câu trả lời', () => {
    const questions = [
      makeQuestion({ id: 'q1', correct: 2, domain: 'hardware' }),
      makeQuestion({ id: 'q2', correct: 0, domain: 'software' })
    ];
    const answers = [
      { questionId: 'q1', selectedAnswer: 2 },
      { questionId: 'q2', selectedAnswer: 1 }
    ];

    const result = calculateScore(answers, questions);
    expect(result.answers).toHaveLength(2);
    expect(result.answers[0]).toEqual({
      questionId: 'q1',
      selectedAnswer: 2,
      correctAnswer: 2,
      isCorrect: true
    });
    expect(result.answers[1]).toEqual({
      questionId: 'q2',
      selectedAnswer: 1,
      correctAnswer: 0,
      isCorrect: false
    });
  });

  it('xử lý câu hỏi chưa trả lời (null)', () => {
    const questions = [
      makeQuestion({ id: 'q1', correct: 2, domain: 'hardware' })
    ];
    const answers = [
      { questionId: 'q1', selectedAnswer: null }
    ];

    const result = calculateScore(answers, questions);
    expect(result.correctCount).toBe(0);
    expect(result.answers[0].isCorrect).toBe(false);
  });

  it('xử lý multiple-choice đúng', () => {
    const questions = [
      makeQuestion({ id: 'q1', type: 'multiple-choice', correct: [0, 2], domain: 'software' })
    ];
    const answers = [
      { questionId: 'q1', selectedAnswer: [2, 0] }  // khác thứ tự nhưng đúng
    ];

    const result = calculateScore(answers, questions);
    expect(result.correctCount).toBe(1);
    expect(result.answers[0].isCorrect).toBe(true);
  });

  it('xử lý drag-drop — phải đúng thứ tự', () => {
    const questions = [
      makeQuestion({ id: 'q1', type: 'drag-drop', correct: [0, 1, 2, 3], domain: 'networking' })
    ];

    // Đúng thứ tự
    const result1 = calculateScore(
      [{ questionId: 'q1', selectedAnswer: [0, 1, 2, 3] }],
      questions
    );
    expect(result1.answers[0].isCorrect).toBe(true);

    // Sai thứ tự
    const result2 = calculateScore(
      [{ questionId: 'q1', selectedAnswer: [1, 0, 2, 3] }],
      questions
    );
    expect(result2.answers[0].isCorrect).toBe(false);
  });

  it('xử lý true-false', () => {
    const questions = [
      makeQuestion({ id: 'q1', type: 'true-false', options: ['Đúng', 'Sai'], correct: 0, domain: 'hardware' })
    ];
    const answers = [{ questionId: 'q1', selectedAnswer: 0 }];

    const result = calculateScore(answers, questions);
    expect(result.correctCount).toBe(1);
    expect(result.totalScore).toBe(1000);
  });

  it('xử lý input không hợp lệ — answers null', () => {
    const result = calculateScore(null, []);
    expect(result.totalScore).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.totalQuestions).toBe(0);
    expect(result.answers).toEqual([]);
  });

  it('xử lý input không hợp lệ — questions null', () => {
    const result = calculateScore([], null);
    expect(result.totalScore).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('xử lý bài thi rỗng (0 câu)', () => {
    const result = calculateScore([], []);
    expect(result.totalScore).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.totalQuestions).toBe(0);
    expect(result.correctCount).toBe(0);
  });

  it('xử lý answer với questionId không tồn tại', () => {
    const questions = [makeQuestion({ id: 'q1', correct: 0, domain: 'hardware' })];
    const answers = [{ questionId: 'q_unknown', selectedAnswer: 0 }];

    const result = calculateScore(answers, questions);
    expect(result.correctCount).toBe(0);
    expect(result.answers[0].isCorrect).toBe(false);
    expect(result.answers[0].correctAnswer).toBeNull();
  });

  it('tính điểm chính xác cho đề thi 45 câu mô phỏng', () => {
    const domains = ['hardware', 'software', 'networking'];
    const questions = Array.from({ length: 45 }, (_, i) =>
      makeQuestion({ id: `q${i}`, correct: 0, domain: domains[i % 3] })
    );
    // 32 đúng / 45 = 711.11 → round = 711
    const answers = questions.map((q, i) => ({
      questionId: q.id,
      selectedAnswer: i < 32 ? 0 : 1
    }));

    const result = calculateScore(answers, questions);
    expect(result.totalScore).toBe(Math.round((32 / 45) * 1000));
    expect(result.passed).toBe(true);
    expect(result.correctCount).toBe(32);
    expect(result.totalQuestions).toBe(45);
  });
});
