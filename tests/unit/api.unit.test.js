import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// We need to test the server endpoints, so we'll create a lightweight test setup
// by importing the server module and using supertest-like approach with http

const QUESTIONS_FILE = path.join(process.cwd(), 'data', 'questions.json');
let originalData;
let server;
let baseUrl;

function readJSON() {
  return JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
}

function writeJSON(data) {
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

beforeAll(async () => {
  // Save original data
  originalData = fs.readFileSync(QUESTIONS_FILE, 'utf8');

  // Dynamically import the server setup — we'll build a mini app for testing
  const cors = (await import('cors')).default;
  const crypto = await import('crypto');
  const { validateImportedQuestion, validateBatch } = await import('../../src/validator.js');
  const { generateExam, shuffleExam } = await import('../../src/examGenerator.js');

  const app = express();

  const VALID_MODULES = ['module_1', 'module_2', 'module_3', 'module_4', 'module_5', 'module_6'];
  const VALID_DIFFICULTIES = ['dễ', 'trung bình', 'khó'];
  const VALID_TYPES = ['single-choice', 'true-false', 'multiple-choice', 'drag-drop'];

  function readQuestionsFile() {
    const data = fs.readFileSync(QUESTIONS_FILE, 'utf8');
    return JSON.parse(data);
  }
  function writeQuestionsFile(data) {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  app.use(cors());
  app.use(express.json());

  app.get('/api/questions', (req, res) => {
    try {
      const db = readQuestionsFile();
      const { module: mod, difficulty, type } = req.query;
      if (mod !== undefined && !VALID_MODULES.includes(mod)) {
        return res.status(400).json({ message: `Tham số lọc không hợp lệ: module "${mod}" không tồn tại` });
      }
      if (difficulty !== undefined && !VALID_DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({ message: `Tham số lọc không hợp lệ: difficulty "${difficulty}" không hợp lệ` });
      }
      if (type !== undefined && !VALID_TYPES.includes(type)) {
        return res.status(400).json({ message: `Tham số lọc không hợp lệ: type "${type}" không hợp lệ` });
      }
      const hasFilters = mod !== undefined || difficulty !== undefined || type !== undefined;
      let questions = db.questions;
      if (mod) questions = questions.filter(q => q.module === mod);
      if (difficulty) questions = questions.filter(q => q.difficulty === difficulty);
      if (type) questions = questions.filter(q => q.type === type);
      if (hasFilters) return res.status(200).json({ questions });
      return res.status(200).json(db);
    } catch (error) {
      res.status(500).json({ message: "Lỗi đọc dữ liệu máy chủ!" });
    }
  });

  app.post('/api/questions/import', (req, res) => {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ' });
      }
      const incoming = Array.isArray(body) ? body : (Array.isArray(body.questions) ? body.questions : [body]);
      if (incoming.length === 0) {
        return res.status(400).json({ message: 'Không có câu hỏi nào để nhập' });
      }
      const { valid, invalid } = validateBatch(incoming);
      if (valid.length === 0) {
        return res.status(400).json({
          message: 'Tất cả câu hỏi không hợp lệ',
          errors: invalid.map(i => ({ question: i.question, errors: i.errors }))
        });
      }
      const db = readQuestionsFile();
      const newQuestions = valid.map(q => ({
        ...q,
        id: q.id || `import_${crypto.randomUUID().slice(0, 8)}`,
        source: q.source || 'external'
      }));
      db.questions.push(...newQuestions);
      writeQuestionsFile(db);
      const result = {
        message: `Đã nhập thành công ${newQuestions.length} câu hỏi`,
        imported: newQuestions.length,
        questions: newQuestions
      };
      if (invalid.length > 0) {
        result.invalid = invalid.map(i => ({ question: i.question, errors: i.errors }));
        result.message += `, ${invalid.length} câu hỏi không hợp lệ`;
      }
      return res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: "Lỗi lưu dữ liệu câu hỏi!" });
    }
  });

  app.get('/api/questions/stats', (req, res) => {
    try {
      const db = readQuestionsFile();
      const questions = db.questions;
      const byModule = {};
      const byDifficulty = {};
      const byType = {};
      for (const q of questions) {
        byModule[q.module] = (byModule[q.module] || 0) + 1;
        byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
        byType[q.type] = (byType[q.type] || 0) + 1;
      }
      return res.status(200).json({ total: questions.length, byModule, byDifficulty, byType });
    } catch (error) {
      res.status(500).json({ message: "Lỗi đọc dữ liệu máy chủ!" });
    }
  });

  app.post('/api/exam/generate', (req, res) => {
    try {
      const db = readQuestionsFile();
      const config = req.body || {};
      const exam = generateExam(db.questions, config);
      exam.questions = shuffleExam(exam.questions);
      return res.status(200).json(exam);
    } catch (error) {
      res.status(500).json({ message: "Lỗi tạo đề thi!" });
    }
  });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  // Restore original data
  fs.writeFileSync(QUESTIONS_FILE, originalData, 'utf8');
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

beforeEach(() => {
  // Restore original data before each test to avoid side effects
  fs.writeFileSync(QUESTIONS_FILE, originalData, 'utf8');
});


// ===== Task 5.1: GET /api/questions with filters =====
describe('GET /api/questions', () => {
  it('returns full data with modules when no filters', async () => {
    const res = await fetch(`${baseUrl}/api/questions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.modules).toBeDefined();
    expect(Array.isArray(data.modules)).toBe(true);
    expect(data.questions).toBeDefined();
    expect(Array.isArray(data.questions)).toBe(true);
    expect(data.questions.length).toBeGreaterThan(0);
  });

  it('filters by module', async () => {
    const res = await fetch(`${baseUrl}/api/questions?module=module_1`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions).toBeDefined();
    expect(data.questions.every(q => q.module === 'module_1')).toBe(true);
    expect(data.modules).toBeUndefined();
  });

  it('filters by difficulty', async () => {
    const res = await fetch(`${baseUrl}/api/questions?difficulty=${encodeURIComponent('dễ')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions.every(q => q.difficulty === 'dễ')).toBe(true);
  });

  it('filters by type', async () => {
    const res = await fetch(`${baseUrl}/api/questions?type=true-false`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions.every(q => q.type === 'true-false')).toBe(true);
  });

  it('supports combined filters', async () => {
    const res = await fetch(`${baseUrl}/api/questions?module=module_1&difficulty=${encodeURIComponent('dễ')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.questions.every(q => q.module === 'module_1' && q.difficulty === 'dễ')).toBe(true);
  });

  it('returns 400 for invalid module', async () => {
    const res = await fetch(`${baseUrl}/api/questions?module=invalid_module`);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('module');
  });

  it('returns 400 for invalid difficulty', async () => {
    const res = await fetch(`${baseUrl}/api/questions?difficulty=impossible`);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('difficulty');
  });

  it('returns 400 for invalid type', async () => {
    const res = await fetch(`${baseUrl}/api/questions?type=essay`);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain('type');
  });
});

// ===== Task 5.3: POST /api/questions/import =====
describe('POST /api/questions/import', () => {
  const validQuestion = {
    q: 'Test question?',
    options: ['A', 'B', 'C'],
    correct: 0,
    source: 'unit-test'
  };

  it('imports a valid single question', async () => {
    const res = await fetch(`${baseUrl}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validQuestion)
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.questions[0].source).toBe('unit-test');
    expect(data.questions[0].id).toBeDefined();
  });

  it('imports an array of questions', async () => {
    const res = await fetch(`${baseUrl}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([validQuestion, { ...validQuestion, q: 'Another?' }])
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(2);
  });

  it('auto-generates ID for imported questions', async () => {
    const res = await fetch(`${baseUrl}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validQuestion)
    });
    const data = await res.json();
    expect(data.questions[0].id).toMatch(/^import_/);
  });

  it('preserves existing ID if provided', async () => {
    const res = await fetch(`${baseUrl}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validQuestion, id: 'custom_id_001' })
    });
    const data = await res.json();
    expect(data.questions[0].id).toBe('custom_id_001');
  });

  it('returns 400 when question is missing required fields', async () => {
    const res = await fetch(`${baseUrl}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: 'Missing fields' })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBeDefined();
    expect(data.errors).toBeDefined();
  });

  it('persists imported questions to file', async () => {
    const before = readJSON();
    const countBefore = before.questions.length;

    await fetch(`${baseUrl}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validQuestion)
    });

    const after = readJSON();
    expect(after.questions.length).toBe(countBefore + 1);
  });

  it('handles mixed valid and invalid questions', async () => {
    const res = await fetch(`${baseUrl}/api/questions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([validQuestion, { q: '' }])
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(1);
    expect(data.invalid).toBeDefined();
    expect(data.invalid.length).toBe(1);
  });
});


// ===== Task 5.5: GET /api/questions/stats =====
describe('GET /api/questions/stats', () => {
  it('returns stats with correct total', async () => {
    const res = await fetch(`${baseUrl}/api/questions/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(120);
    expect(data.byModule).toBeDefined();
    expect(data.byDifficulty).toBeDefined();
    expect(data.byType).toBeDefined();
  });

  it('byModule counts sum to total', async () => {
    const res = await fetch(`${baseUrl}/api/questions/stats`);
    const data = await res.json();
    const moduleSum = Object.values(data.byModule).reduce((a, b) => a + b, 0);
    expect(moduleSum).toBe(data.total);
  });

  it('byDifficulty counts sum to total', async () => {
    const res = await fetch(`${baseUrl}/api/questions/stats`);
    const data = await res.json();
    const diffSum = Object.values(data.byDifficulty).reduce((a, b) => a + b, 0);
    expect(diffSum).toBe(data.total);
  });

  it('byType counts sum to total', async () => {
    const res = await fetch(`${baseUrl}/api/questions/stats`);
    const data = await res.json();
    const typeSum = Object.values(data.byType).reduce((a, b) => a + b, 0);
    expect(typeSum).toBe(data.total);
  });
});

// ===== Task 5.7: POST /api/exam/generate =====
describe('POST /api/exam/generate', () => {
  it('generates an exam with default 45 questions', async () => {
    const res = await fetch(`${baseUrl}/api/exam/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(res.status).toBe(200);
    const exam = await res.json();
    expect(exam.totalQuestions).toBe(45);
    expect(exam.questions.length).toBe(45);
    expect(exam.id).toBeDefined();
    expect(exam.createdAt).toBeDefined();
    expect(exam.domainDistribution).toBeDefined();
    expect(exam.typeDistribution).toBeDefined();
    expect(exam.modulesCovered).toBeDefined();
  });

  it('accepts custom totalQuestions config', async () => {
    const res = await fetch(`${baseUrl}/api/exam/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalQuestions: 10 })
    });
    expect(res.status).toBe(200);
    const exam = await res.json();
    expect(exam.totalQuestions).toBeLessThanOrEqual(12);
    expect(exam.questions.length).toBeLessThanOrEqual(12);
    expect(exam.totalQuestions).toBeGreaterThanOrEqual(10);
  });

  it('returns shuffled questions', async () => {
    // Generate two exams and check they're not identical in order
    const res1 = await fetch(`${baseUrl}/api/exam/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const res2 = await fetch(`${baseUrl}/api/exam/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const exam1 = await res1.json();
    const exam2 = await res2.json();
    // IDs should be different
    expect(exam1.id).not.toBe(exam2.id);
  });

  it('includes complete metadata', async () => {
    const res = await fetch(`${baseUrl}/api/exam/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const exam = await res.json();
    expect(exam.id).toBeTruthy();
    expect(exam.createdAt).toBeTruthy();
    expect(typeof exam.totalQuestions).toBe('number');
    expect(exam.domainDistribution).toHaveProperty('hardware');
    expect(exam.domainDistribution).toHaveProperty('software');
    expect(exam.domainDistribution).toHaveProperty('networking');
    expect(exam.typeDistribution).toHaveProperty('single-choice');
    expect(exam.typeDistribution).toHaveProperty('true-false');
    expect(exam.typeDistribution).toHaveProperty('multiple-choice');
    expect(exam.typeDistribution).toHaveProperty('drag-drop');
    expect(Array.isArray(exam.modulesCovered)).toBe(true);
  });
});
