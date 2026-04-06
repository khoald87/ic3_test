import { describe, it, expect } from 'vitest';
import { validateImportedQuestion, validateBatch, validateCorrectBounds, validateFullQuestion, validateQuestionBank } from '../../src/validator.js';

describe('validateImportedQuestion', () => {
  const validQuestion = {
    q: 'CPU là viết tắt của từ gì?',
    options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Personal Unit'],
    correct: 0,
    source: 'external-bank'
  };

  it('returns valid=true for a complete question', () => {
    const result = validateImportedQuestion(validQuestion);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns error when q is missing', () => {
    const { q, ...noQ } = validQuestion;
    const result = validateImportedQuestion(noQ);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Thiếu trường bắt buộc: q');
  });

  it('returns error when q is empty string', () => {
    const result = validateImportedQuestion({ ...validQuestion, q: '  ' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('q'))).toBe(true);
  });

  it('returns error when options is missing', () => {
    const { options, ...noOpts } = validQuestion;
    const result = validateImportedQuestion(noOpts);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Thiếu trường bắt buộc: options');
  });

  it('returns error when options has fewer than 3 items', () => {
    const result = validateImportedQuestion({ ...validQuestion, options: ['A', 'B'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Trường options phải có ít nhất 3 lựa chọn');
  });

  it('returns error when correct is missing', () => {
    const { correct, ...noCorrect } = validQuestion;
    const result = validateImportedQuestion(noCorrect);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Thiếu trường bắt buộc: correct');
  });

  it('accepts correct as array of numbers', () => {
    const result = validateImportedQuestion({ ...validQuestion, correct: [0, 2] });
    expect(result.valid).toBe(true);
  });

  it('returns error when correct is a string', () => {
    const result = validateImportedQuestion({ ...validQuestion, correct: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('correct'))).toBe(true);
  });

  it('returns error when source is missing', () => {
    const { source, ...noSource } = validQuestion;
    const result = validateImportedQuestion(noSource);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Thiếu trường bắt buộc: source');
  });

  it('returns error when source is empty string', () => {
    const result = validateImportedQuestion({ ...validQuestion, source: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });

  it('returns multiple errors when multiple fields are missing', () => {
    const result = validateImportedQuestion({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(4);
  });

  it('returns error for null input', () => {
    const result = validateImportedQuestion(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error for non-object input', () => {
    const result = validateImportedQuestion('not an object');
    expect(result.valid).toBe(false);
  });
});

describe('validateBatch', () => {
  const validQ1 = { q: 'Câu 1?', options: ['A', 'B', 'C'], correct: 0, source: 'test' };
  const validQ2 = { q: 'Câu 2?', options: ['X', 'Y', 'Z'], correct: 1, source: 'test' };
  const invalidQ = { q: '', options: ['A'], correct: 'bad' };

  it('separates valid and invalid questions', () => {
    const result = validateBatch([validQ1, invalidQ, validQ2]);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].question).toBe(invalidQ);
    expect(result.invalid[0].errors.length).toBeGreaterThan(0);
  });

  it('returns all valid when all questions are correct', () => {
    const result = validateBatch([validQ1, validQ2]);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
  });

  it('returns all invalid when all questions are bad', () => {
    const result = validateBatch([invalidQ]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
  });

  it('handles empty array', () => {
    const result = validateBatch([]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });

  it('handles non-array input gracefully', () => {
    const result = validateBatch('not an array');
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });
});

describe('validateCorrectBounds', () => {
  it('returns valid for correct number within bounds', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: 0 });
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns valid for correct at last index', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: 2 });
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns invalid when correct >= options.length', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: 3 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('correct');
  });

  it('returns invalid for negative correct', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: -1 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('correct');
  });

  it('returns invalid for non-integer correct', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: 1.5 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('correct');
  });

  it('returns valid for correct array within bounds', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C', 'D'], correct: [0, 2] });
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns invalid when array element >= options.length', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: [0, 3] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('correct[1]');
  });

  it('returns invalid when array element is negative', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: [-1, 0] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('correct[0]');
  });

  it('returns invalid when array element is non-integer', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: [0.5] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('correct[0]');
  });

  it('returns invalid for missing options', () => {
    const result = validateCorrectBounds({ correct: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('options');
  });

  it('returns invalid for null question', () => {
    const result = validateCorrectBounds(null);
    expect(result.valid).toBe(false);
  });

  it('returns invalid for missing correct', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('correct');
  });

  it('returns invalid when correct is a string', () => {
    const result = validateCorrectBounds({ options: ['A', 'B', 'C'], correct: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('correct');
  });
});

describe('validateImportedQuestion - correct bounds integration', () => {
  const baseQuestion = {
    q: 'Test question?',
    options: ['A', 'B', 'C'],
    correct: 0,
    source: 'test'
  };

  it('rejects question with correct out of bounds', () => {
    const result = validateImportedQuestion({ ...baseQuestion, correct: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('correct'))).toBe(true);
  });

  it('rejects question with negative correct', () => {
    const result = validateImportedQuestion({ ...baseQuestion, correct: -1 });
    expect(result.valid).toBe(false);
  });

  it('rejects question with array correct out of bounds', () => {
    const result = validateImportedQuestion({ ...baseQuestion, correct: [0, 3] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('correct'))).toBe(true);
  });

  it('accepts question with valid array correct', () => {
    const result = validateImportedQuestion({ ...baseQuestion, correct: [0, 2] });
    expect(result.valid).toBe(true);
  });
});


describe('validateFullQuestion', () => {
  const validFullQuestion = {
    id: 'q_hw_001',
    q: 'CPU là viết tắt của từ gì?',
    type: 'single-choice',
    options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Personal Unit'],
    correct: 0,
    explanation: 'CPU = Central Processing Unit',
    difficulty: 'dễ',
    domain: 'hardware',
    module: 'module_1'
  };

  it('returns valid=true for a complete valid question', () => {
    const result = validateFullQuestion(validFullQuestion);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns error when id is missing', () => {
    const { id, ...noId } = validFullQuestion;
    const result = validateFullQuestion(noId);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Thiếu trường bắt buộc: id');
  });

  it('returns error when id is empty string', () => {
    const result = validateFullQuestion({ ...validFullQuestion, id: '  ' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('returns error for invalid type value', () => {
    const result = validateFullQuestion({ ...validFullQuestion, type: 'essay' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('type'))).toBe(true);
  });

  it('accepts all valid type values', () => {
    for (const type of ['single-choice', 'true-false', 'multiple-choice', 'drag-drop']) {
      const result = validateFullQuestion({ ...validFullQuestion, type });
      expect(result.valid).toBe(true);
    }
  });

  it('returns error for invalid domain value', () => {
    const result = validateFullQuestion({ ...validFullQuestion, domain: 'security' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('domain'))).toBe(true);
  });

  it('accepts all valid domain values', () => {
    for (const domain of ['hardware', 'software', 'networking']) {
      const result = validateFullQuestion({ ...validFullQuestion, domain });
      expect(result.valid).toBe(true);
    }
  });

  it('returns error for invalid module value', () => {
    const result = validateFullQuestion({ ...validFullQuestion, module: 'module_7' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('module'))).toBe(true);
  });

  it('accepts all valid module values', () => {
    for (let i = 1; i <= 6; i++) {
      const result = validateFullQuestion({ ...validFullQuestion, module: `module_${i}` });
      expect(result.valid).toBe(true);
    }
  });

  it('returns error for invalid difficulty value', () => {
    const result = validateFullQuestion({ ...validFullQuestion, difficulty: 'siêu khó' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('difficulty'))).toBe(true);
  });

  it('accepts all valid difficulty values', () => {
    for (const difficulty of ['dễ', 'trung bình', 'khó']) {
      const result = validateFullQuestion({ ...validFullQuestion, difficulty });
      expect(result.valid).toBe(true);
    }
  });

  it('returns error when explanation is missing', () => {
    const { explanation, ...noExpl } = validFullQuestion;
    const result = validateFullQuestion(noExpl);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Thiếu trường bắt buộc: explanation');
  });

  it('checks correct bounds via validateCorrectBounds', () => {
    const result = validateFullQuestion({ ...validFullQuestion, correct: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('correct'))).toBe(true);
  });

  it('returns multiple errors for multiple invalid fields', () => {
    const result = validateFullQuestion({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(9);
  });

  it('returns error for null input', () => {
    const result = validateFullQuestion(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Câu hỏi phải là một đối tượng hợp lệ');
  });

  it('accepts true-false question with 2 options', () => {
    const tfQuestion = {
      ...validFullQuestion,
      type: 'true-false',
      options: ['Đúng', 'Sai'],
      correct: 0
    };
    const result = validateFullQuestion(tfQuestion);
    expect(result.valid).toBe(true);
  });
});

describe('validateQuestionBank', () => {
  const validQ1 = {
    id: 'q1', q: 'Câu 1?', type: 'single-choice',
    options: ['A', 'B', 'C'], correct: 0,
    explanation: 'Giải thích', difficulty: 'dễ',
    domain: 'hardware', module: 'module_1'
  };
  const validQ2 = {
    id: 'q2', q: 'Câu 2?', type: 'true-false',
    options: ['Đúng', 'Sai'], correct: 1,
    explanation: 'Giải thích', difficulty: 'khó',
    domain: 'software', module: 'module_3'
  };
  const invalidQ = { id: '', q: '', type: 'essay' };

  it('returns correct valid count and invalid list', () => {
    const result = validateQuestionBank([validQ1, invalidQ, validQ2]);
    expect(result.valid).toBe(2);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].index).toBe(1);
    expect(result.invalid[0].errors.length).toBeGreaterThan(0);
  });

  it('returns all valid when all questions are correct', () => {
    const result = validateQuestionBank([validQ1, validQ2]);
    expect(result.valid).toBe(2);
    expect(result.invalid).toHaveLength(0);
  });

  it('returns id for invalid questions', () => {
    const badQ = { ...validQ1, id: 'bad_q', type: 'invalid-type' };
    const result = validateQuestionBank([badQ]);
    expect(result.invalid[0].id).toBe('bad_q');
  });

  it('returns "unknown" id when question has no id', () => {
    const result = validateQuestionBank([{}]);
    expect(result.invalid[0].id).toBe('unknown');
  });

  it('handles empty array', () => {
    const result = validateQuestionBank([]);
    expect(result.valid).toBe(0);
    expect(result.invalid).toHaveLength(0);
  });

  it('handles non-array input gracefully', () => {
    const result = validateQuestionBank('not an array');
    expect(result.valid).toBe(0);
    expect(result.invalid).toHaveLength(0);
  });

  it('detects invalid enum values in bank', () => {
    const badDomain = { ...validQ1, domain: 'physics' };
    const result = validateQuestionBank([badDomain]);
    expect(result.valid).toBe(0);
    expect(result.invalid[0].errors.some(e => e.includes('domain'))).toBe(true);
  });
});
