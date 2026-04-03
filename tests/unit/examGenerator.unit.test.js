import { describe, it, expect } from 'vitest';
import { generateExam, shuffleExam } from '../../src/examGenerator.js';

/**
 * Helper: tạo ngân hàng câu hỏi giả lập với phân bổ đều
 */
function createQuestionBank(count = 120) {
  const domains = ['hardware', 'software', 'networking'];
  const types = ['single-choice', 'true-false', 'multiple-choice', 'drag-drop'];
  const modules = ['module_1', 'module_2', 'module_3', 'module_4', 'module_5', 'module_6'];
  const questions = [];

  for (let i = 0; i < count; i++) {
    const domain = domains[i % 3];
    const type = types[i % 4];
    const mod = modules[i % 6];

    const base = {
      id: `q_${String(i + 1).padStart(3, '0')}`,
      q: `Câu hỏi số ${i + 1}?`,
      explanation: `Giải thích câu ${i + 1}`,
      difficulty: ['dễ', 'trung bình', 'khó'][i % 3],
      domain,
      module: mod
    };

    if (type === 'single-choice') {
      Object.assign(base, { type, options: ['A', 'B', 'C', 'D'], correct: i % 4 });
    } else if (type === 'true-false') {
      Object.assign(base, { type, options: ['Đúng', 'Sai'], correct: i % 2 });
    } else if (type === 'multiple-choice') {
      Object.assign(base, { type, options: ['A', 'B', 'C', 'D'], correct: [0, 2] });
    } else {
      Object.assign(base, { type, options: ['Bước 1', 'Bước 2', 'Bước 3', 'Bước 4'], correct: [0, 1, 2, 3] });
    }

    questions.push(base);
  }
  return questions;
}

describe('generateExam', () => {
  const bank = createQuestionBank(120);

  it('tạo đề thi với đúng 45 câu hỏi', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    expect(exam.totalQuestions).toBe(45);
    expect(exam.questions).toHaveLength(45);
  });

  it('có metadata đầy đủ: id, createdAt, totalQuestions, timeLimit, domainDistribution, typeDistribution, modulesCovered', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    expect(exam.id).toBeDefined();
    expect(typeof exam.id).toBe('string');
    expect(exam.id.length).toBeGreaterThan(0);
    expect(exam.createdAt).toBeDefined();
    expect(new Date(exam.createdAt).toISOString()).toBe(exam.createdAt);
    expect(exam.totalQuestions).toBe(45);
    expect(exam.timeLimit).toBe(50);
    expect(exam.domainDistribution).toBeDefined();
    expect(exam.domainDistribution).toHaveProperty('hardware');
    expect(exam.domainDistribution).toHaveProperty('software');
    expect(exam.domainDistribution).toHaveProperty('networking');
    expect(exam.typeDistribution).toBeDefined();
    expect(exam.typeDistribution).toHaveProperty('single-choice');
    expect(exam.typeDistribution).toHaveProperty('true-false');
    expect(exam.typeDistribution).toHaveProperty('multiple-choice');
    expect(exam.typeDistribution).toHaveProperty('drag-drop');
    expect(Array.isArray(exam.modulesCovered)).toBe(true);
  });

  it('phân bổ cân đối theo 3 lĩnh vực (chênh lệch tối đa 1 câu)', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    const { hardware, software, networking } = exam.domainDistribution;
    const counts = [hardware, software, networking];
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    expect(max - min).toBeLessThanOrEqual(1);
    expect(hardware + software + networking).toBe(45);
  });

  it('bao gồm tối thiểu 1 câu mỗi dạng câu hỏi', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    expect(exam.typeDistribution['single-choice']).toBeGreaterThanOrEqual(1);
    expect(exam.typeDistribution['true-false']).toBeGreaterThanOrEqual(1);
    expect(exam.typeDistribution['multiple-choice']).toBeGreaterThanOrEqual(1);
    expect(exam.typeDistribution['drag-drop']).toBeGreaterThanOrEqual(1);
  });

  it('không có câu hỏi trùng lặp', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    const ids = exam.questions.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('domainDistribution khớp với câu hỏi thực tế', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    const actual = { hardware: 0, software: 0, networking: 0 };
    for (const q of exam.questions) {
      actual[q.domain]++;
    }
    expect(actual).toEqual(exam.domainDistribution);
  });

  it('typeDistribution khớp với câu hỏi thực tế', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    const actual = { 'single-choice': 0, 'true-false': 0, 'multiple-choice': 0, 'drag-drop': 0 };
    for (const q of exam.questions) {
      actual[q.type]++;
    }
    expect(actual).toEqual(exam.typeDistribution);
  });

  it('modulesCovered chứa đúng các module có trong đề', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    const actualModules = [...new Set(exam.questions.map(q => q.module))].sort();
    expect(exam.modulesCovered).toEqual(actualModules);
  });

  it('xử lý khi không đủ 45 câu — trả về warning', () => {
    const smallBank = createQuestionBank(10);
    const exam = generateExam(smallBank, { totalQuestions: 45 });
    expect(exam.totalQuestions).toBe(10);
    expect(exam.questions).toHaveLength(10);
    expect(exam.warning).toBeDefined();
    expect(exam.warning).toContain('10');
  });

  it('xử lý ngân hàng câu hỏi rỗng', () => {
    const exam = generateExam([], { totalQuestions: 45 });
    expect(exam.totalQuestions).toBe(0);
    expect(exam.questions).toHaveLength(0);
    expect(exam.warning).toBeDefined();
  });

  it('xử lý input không phải mảng', () => {
    const exam = generateExam(null, { totalQuestions: 45 });
    expect(exam.totalQuestions).toBe(0);
    expect(exam.questions).toHaveLength(0);
    expect(exam.warning).toBeDefined();
  });

  it('không có warning khi đủ câu hỏi', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    expect(exam.warning).toBeUndefined();
  });

  it('sử dụng UUID cho exam id', () => {
    const exam = generateExam(bank, { totalQuestions: 45 });
    // UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(exam.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('config mặc định totalQuestions = 45', () => {
    const exam = generateExam(bank, {});
    expect(exam.totalQuestions).toBe(45);
  });
});

describe('shuffleExam', () => {
  const sampleQuestions = [
    { id: 'q1', type: 'single-choice', q: 'Q1?', options: ['A', 'B', 'C', 'D'], correct: 0 },
    { id: 'q2', type: 'true-false', q: 'Q2?', options: ['Đúng', 'Sai'], correct: 1 },
    { id: 'q3', type: 'multiple-choice', q: 'Q3?', options: ['X', 'Y', 'Z', 'W'], correct: [0, 2] },
    { id: 'q4', type: 'drag-drop', q: 'Q4?', options: ['Bước 1', 'Bước 2', 'Bước 3'], correct: [0, 1, 2] }
  ];

  it('trả về mảng mới, không thay đổi mảng gốc', () => {
    const original = JSON.parse(JSON.stringify(sampleQuestions));
    const shuffled = shuffleExam(sampleQuestions);
    expect(sampleQuestions).toEqual(original);
    expect(shuffled).not.toBe(sampleQuestions);
  });

  it('bảo toàn số lượng câu hỏi', () => {
    const shuffled = shuffleExam(sampleQuestions);
    expect(shuffled).toHaveLength(sampleQuestions.length);
  });

  it('bảo toàn tất cả ID câu hỏi', () => {
    const shuffled = shuffleExam(sampleQuestions);
    const originalIds = sampleQuestions.map(q => q.id).sort();
    const shuffledIds = shuffled.map(q => q.id).sort();
    expect(shuffledIds).toEqual(originalIds);
  });

  it('giữ nguyên options cho true-false', () => {
    const shuffled = shuffleExam(sampleQuestions);
    const tfQuestion = shuffled.find(q => q.type === 'true-false');
    expect(tfQuestion.options).toEqual(['Đúng', 'Sai']);
    expect(tfQuestion.correct).toBe(1);
  });

  it('giữ nguyên options cho drag-drop', () => {
    const shuffled = shuffleExam(sampleQuestions);
    const ddQuestion = shuffled.find(q => q.type === 'drag-drop');
    expect(ddQuestion.options).toEqual(['Bước 1', 'Bước 2', 'Bước 3']);
    expect(ddQuestion.correct).toEqual([0, 1, 2]);
  });

  it('single-choice: correct index vẫn trỏ đúng đáp án sau xáo trộn', () => {
    const scQuestion = { id: 'sc1', type: 'single-choice', q: 'Test?', options: ['A', 'B', 'C', 'D'], correct: 2 };
    // Chạy nhiều lần để đảm bảo tính đúng đắn
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffleExam([scQuestion]);
      const q = shuffled[0];
      expect(q.options[q.correct]).toBe('C'); // 'C' là đáp án đúng gốc (index 2)
    }
  });

  it('multiple-choice: correct array vẫn trỏ đúng đáp án sau xáo trộn', () => {
    const mcQuestion = { id: 'mc1', type: 'multiple-choice', q: 'Test?', options: ['X', 'Y', 'Z', 'W'], correct: [0, 2] };
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffleExam([mcQuestion]);
      const q = shuffled[0];
      const correctValues = q.correct.map(idx => q.options[idx]).sort();
      expect(correctValues).toEqual(['X', 'Z']); // 'X' (0) và 'Z' (2) là đáp án đúng gốc
    }
  });

  it('xử lý mảng rỗng', () => {
    const shuffled = shuffleExam([]);
    expect(shuffled).toEqual([]);
  });

  it('xử lý input không phải mảng', () => {
    const shuffled = shuffleExam(null);
    expect(shuffled).toEqual([]);
  });
});
