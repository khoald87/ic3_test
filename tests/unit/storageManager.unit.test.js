import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

  describe('getExamHistoryFromServer', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('trả về null khi studentName rỗng', async () => {
      const result = await SM.getExamHistoryFromServer('');
      expect(result).toBeNull();
    });

    it('trả về null khi studentName null', async () => {
      const result = await SM.getExamHistoryFromServer(null);
      expect(result).toBeNull();
    });

    it('trả về mảng history khi server phản hồi thành công', async () => {
      const mockHistory = [
        { examId: 'e1', score: 800, date: '2024-01-01' },
        { examId: 'e2', score: 700, date: '2024-01-02' }
      ];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ history: mockHistory })
      });

      const result = await SM.getExamHistoryFromServer('Nguyen Van A');
      expect(result).toEqual(mockHistory);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/students/' + encodeURIComponent('Nguyen Van A') + '/history'
      );
    });

    it('trả về null khi server trả lỗi (non-ok)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await SM.getExamHistoryFromServer('Test');
      expect(result).toBeNull();
    });

    it('trả về null khi fetch throw (network error)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await SM.getExamHistoryFromServer('Test');
      expect(result).toBeNull();
    });

    it('trả về null khi response không có mảng history', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'something else' })
      });

      const result = await SM.getExamHistoryFromServer('Test');
      expect(result).toBeNull();
    });
  });

  describe('saveExamResultToServer', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('trả về { success: false } khi studentName rỗng', async () => {
      const result = await SM.saveExamResultToServer('', { examId: 'e1' });
      expect(result).toEqual({ success: false });
    });

    it('trả về { success: false } khi result null', async () => {
      const result = await SM.saveExamResultToServer('Test', null);
      expect(result).toEqual({ success: false });
    });

    it('trả về { success: true } khi lưu thành công', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      const result = await SM.saveExamResultToServer('Test', { examId: 'e1', score: 800 });
      expect(result).toEqual({ success: true });
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('retry 1 lần khi lần đầu thất bại, lần 2 thành công', async () => {
      globalThis.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true });

      const result = await SM.saveExamResultToServer('Test', { examId: 'e1' });
      expect(result).toEqual({ success: true });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('trả về { success: false } khi cả 2 lần đều thất bại', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await SM.saveExamResultToServer('Test', { examId: 'e1' });
      expect(result).toEqual({ success: false });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('retry khi server trả non-ok status', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true });

      const result = await SM.saveExamResultToServer('Test', { examId: 'e1' });
      expect(result).toEqual({ success: true });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
