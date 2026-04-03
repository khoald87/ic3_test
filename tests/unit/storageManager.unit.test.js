import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests cho Storage Manager
 */

// In-memory localStorage mock
function createMockLocalStorage() {
  const store = {};
  return {
    getItem: vi.fn((key) => store[key] !== undefined ? store[key] : null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
    _store: store
  };
}

function loadStorageManager(mockLS) {
  delete globalThis.window?.StorageManager;
  if (!globalThis.window) globalThis.window = {};
  globalThis.localStorage = mockLS;

  const fs = require('fs');
  const path = require('path');
  const code = fs.readFileSync(path.join(__dirname, '../../public/storageManager.js'), 'utf-8');
  eval(code);

  return globalThis.window.StorageManager;
}

describe('StorageManager', () => {
  let SM;
  let mockLS;

  beforeEach(() => {
    mockLS = createMockLocalStorage();
    SM = loadStorageManager(mockLS);
  });

  describe('saveExamResult', () => {
    it('lưu kết quả bài thi vào localStorage', () => {
      const result = { examId: 'e1', date: '2024-01-01T00:00:00Z', score: 800 };
      expect(SM.saveExamResult(result)).toBe(true);
      expect(mockLS.setItem).toHaveBeenCalled();
    });

    it('trả về false nếu result null', () => {
      expect(SM.saveExamResult(null)).toBe(false);
    });

    it('trả về false nếu thiếu examId', () => {
      expect(SM.saveExamResult({ score: 500 })).toBe(false);
    });

    it('thêm vào đầu danh sách (mới nhất trước)', () => {
      SM.saveExamResult({ examId: 'e1', date: '2024-01-01T00:00:00Z', score: 600 });
      SM.saveExamResult({ examId: 'e2', date: '2024-01-02T00:00:00Z', score: 800 });
      
      const history = SM.getExamHistory();
      expect(history[0].examId).toBe('e2');
      expect(history[1].examId).toBe('e1');
    });
  });

  describe('getExamHistory', () => {
    it('trả về mảng rỗng khi chưa có dữ liệu', () => {
      expect(SM.getExamHistory()).toEqual([]);
    });

    it('sắp xếp mới nhất trước', () => {
      SM.saveExamResult({ examId: 'e1', date: '2024-01-01T00:00:00Z', score: 600 });
      SM.saveExamResult({ examId: 'e2', date: '2024-01-03T00:00:00Z', score: 700 });
      SM.saveExamResult({ examId: 'e3', date: '2024-01-02T00:00:00Z', score: 800 });

      const history = SM.getExamHistory();
      expect(history[0].examId).toBe('e2');
      expect(history[1].examId).toBe('e3');
      expect(history[2].examId).toBe('e1');
    });

    it('trả về mảng rỗng khi dữ liệu bị hỏng', () => {
      mockLS._store['ic3_exam_history'] = 'not-json{{{';
      expect(SM.getExamHistory()).toEqual([]);
    });
  });

  describe('getModuleProgress', () => {
    it('trả về progress mặc định cho module chưa có dữ liệu', () => {
      const progress = SM.getModuleProgress('module_1');
      expect(progress.moduleId).toBe('module_1');
      expect(progress.answeredCorrectly).toEqual([]);
      expect(progress.highestScore).toBe(0);
    });
  });

  describe('updateProgress', () => {
    it('thêm questionId vào answeredCorrectly khi trả lời đúng', () => {
      SM.updateProgress('module_1', 'q1', true);
      const progress = SM.getModuleProgress('module_1');
      expect(progress.answeredCorrectly).toContain('q1');
    });

    it('không thêm trùng lặp questionId', () => {
      SM.updateProgress('module_1', 'q1', true);
      SM.updateProgress('module_1', 'q1', true);
      const progress = SM.getModuleProgress('module_1');
      expect(progress.answeredCorrectly.filter(id => id === 'q1')).toHaveLength(1);
    });

    it('không thêm questionId khi trả lời sai', () => {
      SM.updateProgress('module_1', 'q1', false);
      const progress = SM.getModuleProgress('module_1');
      expect(progress.answeredCorrectly).not.toContain('q1');
    });

    it('cập nhật lastAttemptDate', () => {
      SM.updateProgress('module_1', 'q1', true);
      const progress = SM.getModuleProgress('module_1');
      expect(progress.lastAttemptDate).toBeTruthy();
    });
  });

  describe('getProgressPercent', () => {
    it('trả về 0 khi chưa có tiến trình', () => {
      expect(SM.getProgressPercent('module_1', 20)).toBe(0);
    });

    it('tính phần trăm đúng', () => {
      SM.updateProgress('module_1', 'q1', true);
      SM.updateProgress('module_1', 'q2', true);
      SM.updateProgress('module_1', 'q3', true);
      expect(SM.getProgressPercent('module_1', 10)).toBe(30);
    });

    it('trả về 100 khi trả lời đúng hết', () => {
      SM.updateProgress('module_1', 'q1', true);
      SM.updateProgress('module_1', 'q2', true);
      expect(SM.getProgressPercent('module_1', 2)).toBe(100);
    });

    it('trả về 0 khi totalQuestions = 0', () => {
      expect(SM.getProgressPercent('module_1', 0)).toBe(0);
    });

    it('trả về 0 khi totalQuestions âm', () => {
      expect(SM.getProgressPercent('module_1', -5)).toBe(0);
    });
  });

  describe('xử lý localStorage không khả dụng', () => {
    it('không crash khi localStorage.setItem throw', () => {
      mockLS.setItem.mockImplementation(() => { throw new Error('QuotaExceeded'); });
      expect(SM.saveExamResult({ examId: 'e1', date: '2024-01-01', score: 500 })).toBe(false);
    });

    it('trả về fallback khi localStorage.getItem throw', () => {
      mockLS.getItem.mockImplementation(() => { throw new Error('SecurityError'); });
      expect(SM.getExamHistory()).toEqual([]);
      expect(SM.getModuleProgress('module_1').answeredCorrectly).toEqual([]);
    });
  });
});
