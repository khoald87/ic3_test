/**
 * Storage Manager — localStorage wrapper
 * Quản lý lưu trữ kết quả bài thi và tiến trình module
 */
(function () {
  'use strict';

  var EXAM_HISTORY_KEY = 'ic3_exam_history';
  var PROGRESS_KEY = 'ic3_progress';

  /**
   * Đọc JSON từ localStorage an toàn
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  function safeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('StorageManager: Dữ liệu bị hỏng tại key "' + key + '", đang reset.');
      try { localStorage.removeItem(key); } catch (_) {}
      return fallback;
    }
  }

  /**
   * Ghi JSON vào localStorage an toàn
   * @param {string} key
   * @param {*} value
   * @returns {boolean} true nếu thành công
   */
  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('StorageManager: Không thể lưu dữ liệu. localStorage có thể đầy hoặc không khả dụng.');
      return false;
    }
  }

  /**
   * Lưu kết quả bài thi
   * @param {Object} result — ExamResult object
   * @returns {boolean}
   */
  function saveExamResult(result) {
    if (!result || !result.examId) return false;
    var history = safeGet(EXAM_HISTORY_KEY, []);
    if (!Array.isArray(history)) history = [];
    history.unshift(result);
    return safeSet(EXAM_HISTORY_KEY, history);
  }

  /**
   * Lấy lịch sử bài thi, sắp xếp mới nhất trước
   * @returns {Object[]}
   */
  function getExamHistory() {
    var history = safeGet(EXAM_HISTORY_KEY, []);
    if (!Array.isArray(history)) return [];
    // Sắp xếp mới nhất trước theo date
    history.sort(function (a, b) {
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
    return history;
  }

  /**
   * Lấy tiến trình module
   * @param {string} moduleId
   * @returns {Object} ModuleProgress
   */
  function getModuleProgress(moduleId) {
    var data = safeGet(PROGRESS_KEY, { modules: {} });
    if (!data || typeof data !== 'object' || !data.modules) {
      data = { modules: {} };
    }
    return data.modules[moduleId] || {
      moduleId: moduleId,
      totalQuestions: 0,
      answeredCorrectly: [],
      highestScore: 0,
      lastAttemptDate: null
    };
  }

  /**
   * Cập nhật tiến trình module sau khi trả lời câu hỏi
   * @param {string} moduleId
   * @param {string} questionId
   * @param {boolean} isCorrect
   * @returns {boolean}
   */
  function updateProgress(moduleId, questionId, isCorrect) {
    var data = safeGet(PROGRESS_KEY, { modules: {} });
    if (!data || typeof data !== 'object' || !data.modules) {
      data = { modules: {} };
    }

    if (!data.modules[moduleId]) {
      data.modules[moduleId] = {
        moduleId: moduleId,
        totalQuestions: 0,
        answeredCorrectly: [],
        highestScore: 0,
        lastAttemptDate: null
      };
    }

    var mod = data.modules[moduleId];
    mod.lastAttemptDate = new Date().toISOString();

    if (isCorrect && mod.answeredCorrectly.indexOf(questionId) === -1) {
      mod.answeredCorrectly.push(questionId);
    }

    return safeSet(PROGRESS_KEY, data);
  }

  /**
   * Tính phần trăm tiến trình module
   * @param {string} moduleId
   * @param {number} totalQuestions — tổng số câu hỏi trong module
   * @returns {number} 0-100
   */
  function getProgressPercent(moduleId, totalQuestions) {
    if (!totalQuestions || totalQuestions <= 0) return 0;
    var progress = getModuleProgress(moduleId);
    var correct = (progress.answeredCorrectly || []).length;
    if (correct > totalQuestions) correct = totalQuestions;
    return Math.round((correct / totalQuestions) * 100);
  }

  /**
   * Lấy lịch sử thi từ server
   * @param {string} studentName
   * @returns {Promise<Object[]|null>} mảng history hoặc null nếu lỗi
   */
  function getExamHistoryFromServer(studentName) {
    if (!studentName) return Promise.resolve(null);
    return fetch('/api/students/' + encodeURIComponent(studentName) + '/history')
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (data && Array.isArray(data.history)) return data.history;
        return null;
      })
      .catch(function (e) {
        console.warn('StorageManager: Không thể tải lịch sử từ server', e);
        return null;
      });
  }

  /**
   * Lưu kết quả thi lên server (retry 1 lần nếu lỗi)
   * @param {string} studentName
   * @param {Object} result
   * @returns {Promise<{success: boolean}>}
   */
  function saveExamResultToServer(studentName, result) {
    if (!studentName || !result) return Promise.resolve({ success: false });

    function doSave() {
      return fetch('/api/students/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: studentName, result: result })
      }).then(function (res) {
        if (!res.ok) throw new Error('Server responded with ' + res.status);
        return { success: true };
      });
    }

    return doSave().catch(function (e) {
      console.warn('StorageManager: Lưu kết quả thất bại, thử lại...', e);
      return doSave().catch(function (e2) {
        console.warn('StorageManager: Retry thất bại, không thể lưu kết quả lên server', e2);
        return { success: false };
      });
    });
  }

  /**
   * Lưu tiến trình ôn tập lên server
   * @param {string} studentName
   * @param {string} moduleId
   * @param {string} questionId
   * @param {boolean} isCorrect
   */
  function saveProgressToServer(studentName, moduleId, questionId, isCorrect) {
    if (!studentName || !moduleId || !questionId) return;
    fetch('/api/students/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: studentName, moduleId: moduleId, questionId: questionId, isCorrect: isCorrect })
    }).catch(function (e) {
      console.warn('StorageManager: Không thể lưu tiến trình lên server', e);
    });
  }

  // Expose globally
  window.StorageManager = {
    saveExamResult: saveExamResult,
    getExamHistory: getExamHistory,
    getExamHistoryFromServer: getExamHistoryFromServer,
    getModuleProgress: getModuleProgress,
    updateProgress: updateProgress,
    getProgressPercent: getProgressPercent,
    saveExamResultToServer: saveExamResultToServer,
    saveProgressToServer: saveProgressToServer
  };
})();
