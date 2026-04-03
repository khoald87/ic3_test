import { describe, it, expect } from 'vitest';
import { validateImportedQuestion, validateBatch } from '../../src/validator.js';

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
