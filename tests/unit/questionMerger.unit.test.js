import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Use require for CJS module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { mergeNewQuestions } = require('../../src/questionMerger.js');

/**
 * Simple validate function that mimics validateFullQuestion
 */
function mockValidateFn(question) {
  const errors = [];
  if (!question.id || typeof question.id !== 'string') errors.push('missing id');
  if (!question.q || typeof question.q !== 'string') errors.push('missing q');
  if (!question.type) errors.push('missing type');
  if (!Array.isArray(question.options) || question.options.length < 2) errors.push('bad options');
  if (question.correct === undefined) errors.push('missing correct');
  return { valid: errors.length === 0, errors };
}

describe('questionMerger', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'qmerger-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('should merge new questions into empty questions.json', async () => {
    // Setup: empty questions.json
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({ modules: [], questions: [] }, null, 2)
    );

    // Setup: one new_questions file
    const newQ = [
      { id: 'q1', q: 'Test?', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 },
      { id: 'q2', q: 'Test2?', type: 'true-false', options: ['True', 'False'], correct: 1 }
    ];
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_test.json'),
      JSON.stringify(newQ)
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.invalid).toBe(0);

    // Verify questions.json was updated
    const db = JSON.parse(await fs.promises.readFile(path.join(tmpDir, 'questions.json'), 'utf8'));
    expect(db.questions).toHaveLength(2);
    expect(db.questions[0].id).toBe('q1');
    expect(db.questions[1].id).toBe('q2');
  });

  it('should skip questions with duplicate ids', async () => {
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({
        modules: [],
        questions: [{ id: 'q1', q: 'Existing', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }]
      })
    );

    const newQ = [
      { id: 'q1', q: 'Duplicate', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 },
      { id: 'q2', q: 'New', type: 'single-choice', options: ['A', 'B', 'C'], correct: 1 }
    ];
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_test.json'),
      JSON.stringify(newQ)
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.invalid).toBe(0);

    const db = JSON.parse(await fs.promises.readFile(path.join(tmpDir, 'questions.json'), 'utf8'));
    expect(db.questions).toHaveLength(2);
    // Original question should be preserved
    expect(db.questions[0].q).toBe('Existing');
    expect(db.questions[1].id).toBe('q2');
  });

  it('should skip invalid questions', async () => {
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({ modules: [], questions: [] })
    );

    const newQ = [
      { id: 'q1', q: 'Valid', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 },
      { id: 'q2', q: '', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }, // empty q
      { id: 'q3' } // missing fields
    ];
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_test.json'),
      JSON.stringify(newQ)
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(1);
    expect(result.invalid).toBe(2);
  });

  it('should handle multiple new_questions files', async () => {
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({ modules: [], questions: [] })
    );

    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_m1.json'),
      JSON.stringify([{ id: 'q1', q: 'Q1', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }])
    );
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_m2.json'),
      JSON.stringify([{ id: 'q2', q: 'Q2', type: 'true-false', options: ['T', 'F'], correct: 0 }])
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(2);
    const db = JSON.parse(await fs.promises.readFile(path.join(tmpDir, 'questions.json'), 'utf8'));
    expect(db.questions).toHaveLength(2);
  });

  it('should skip duplicates across multiple new_questions files', async () => {
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({ modules: [], questions: [] })
    );

    // Same id in two different files
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_a.json'),
      JSON.stringify([{ id: 'q1', q: 'First', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }])
    );
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_b.json'),
      JSON.stringify([{ id: 'q1', q: 'Duplicate', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }])
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('should handle missing questions.json gracefully', async () => {
    // No questions.json exists
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_test.json'),
      JSON.stringify([{ id: 'q1', q: 'Q1', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }])
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(1);
    const db = JSON.parse(await fs.promises.readFile(path.join(tmpDir, 'questions.json'), 'utf8'));
    expect(db.questions).toHaveLength(1);
  });

  it('should not write questions.json when no new questions added', async () => {
    const questionsPath = path.join(tmpDir, 'questions.json');
    const original = JSON.stringify({ modules: [], questions: [{ id: 'q1', q: 'Existing', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }] });
    await fs.promises.writeFile(questionsPath, original);
    const statBefore = await fs.promises.stat(questionsPath);

    // All duplicates
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_test.json'),
      JSON.stringify([{ id: 'q1', q: 'Dup', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }])
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
    // File content should be unchanged
    const content = await fs.promises.readFile(questionsPath, 'utf8');
    expect(content).toBe(original);
  });

  it('should handle no new_questions files', async () => {
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({ modules: [], questions: [] })
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.invalid).toBe(0);
  });

  it('should skip questions without id', async () => {
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({ modules: [], questions: [] })
    );

    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_test.json'),
      JSON.stringify([
        { q: 'No id', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 },
        null,
        'not an object'
      ])
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    expect(result.added).toBe(0);
    expect(result.invalid).toBe(3);
  });

  it('should handle corrupted new_questions file gracefully', async () => {
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({ modules: [], questions: [] })
    );

    // Corrupted JSON
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_bad.json'),
      'not valid json {'
    );
    // Valid file
    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_good.json'),
      JSON.stringify([{ id: 'q1', q: 'Q1', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }])
    );

    const result = await mergeNewQuestions(tmpDir, mockValidateFn);

    // Should skip bad file and process good file
    expect(result.added).toBe(1);
  });

  it('should preserve modules array in questions.json', async () => {
    const modules = [{ id: 'module_1', title: 'Module 1', icon: '💻' }];
    await fs.promises.writeFile(
      path.join(tmpDir, 'questions.json'),
      JSON.stringify({ modules, questions: [] })
    );

    await fs.promises.writeFile(
      path.join(tmpDir, 'new_questions_test.json'),
      JSON.stringify([{ id: 'q1', q: 'Q1', type: 'single-choice', options: ['A', 'B', 'C'], correct: 0 }])
    );

    await mergeNewQuestions(tmpDir, mockValidateFn);

    const db = JSON.parse(await fs.promises.readFile(path.join(tmpDir, 'questions.json'), 'utf8'));
    expect(db.modules).toEqual(modules);
  });
});
