/**
 * Exam Generator Module
 * Tạo đề thi thông minh IC3 GS6 Spark Level 1
 */

const crypto = require('crypto');

const DOMAINS = ['hardware', 'software', 'networking'];
const QUESTION_TYPES = ['single-choice', 'true-false', 'multiple-choice', 'drag-drop'];

/**
 * Fisher-Yates shuffle — trả về mảng mới, không thay đổi mảng gốc
 * @param {any[]} arr
 * @returns {any[]}
 */
function fisherYatesShuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Tạo đề thi thông minh
 * @param {Object[]} questionBank - Toàn bộ ngân hàng câu hỏi
 * @param {Object} config - { totalQuestions: 45 }
 * @returns {Object} Exam object với metadata đầy đủ
 */
function generateExam(questionBank, config) {
  const totalQuestions = (config && config.totalQuestions) || 45;
  const timeLimit = 50;

  if (!Array.isArray(questionBank) || questionBank.length === 0) {
    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      totalQuestions: 0,
      timeLimit,
      questions: [],
      domainDistribution: { hardware: 0, software: 0, networking: 0 },
      typeDistribution: { 'single-choice': 0, 'true-false': 0, 'multiple-choice': 0, 'drag-drop': 0 },
      modulesCovered: [],
      warning: 'Ngân hàng câu hỏi trống, không thể tạo đề thi.'
    };
  }

  let warning = null;
  const available = [...questionBank];

  // Nếu không đủ câu hỏi
  if (available.length < totalQuestions) {
    warning = `Không đủ câu hỏi để tạo đề thi ${totalQuestions} câu. Chỉ có ${available.length} câu hỏi.`;
  }

  const selected = [];
  const selectedIds = new Set();

  // Bước 1: Đảm bảo tối thiểu 1 câu mỗi dạng câu hỏi
  for (const type of QUESTION_TYPES) {
    const candidates = available.filter(q => q.type === type && !selectedIds.has(q.id));
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      selected.push(pick);
      selectedIds.add(pick.id);
    }
  }

  // Bước 2: Phân bổ cân đối theo domain
  const targetTotal = Math.min(totalQuestions, available.length);
  const perDomain = Math.floor(targetTotal / DOMAINS.length);
  const remainder = targetTotal - perDomain * DOMAINS.length;

  // Tính target cho mỗi domain
  const domainTargets = {};
  DOMAINS.forEach((domain, i) => {
    domainTargets[domain] = perDomain + (i < remainder ? 1 : 0);
  });

  // Đếm câu đã chọn theo domain
  const domainCounts = { hardware: 0, software: 0, networking: 0 };
  for (const q of selected) {
    if (domainCounts[q.domain] !== undefined) {
      domainCounts[q.domain]++;
    }
  }

  // Bước 3: Bổ sung câu hỏi theo domain để đạt target
  for (const domain of DOMAINS) {
    const needed = domainTargets[domain] - domainCounts[domain];
    if (needed > 0) {
      const candidates = fisherYatesShuffle(
        available.filter(q => q.domain === domain && !selectedIds.has(q.id))
      );
      const toAdd = candidates.slice(0, needed);
      for (const q of toAdd) {
        selected.push(q);
        selectedIds.add(q.id);
        domainCounts[domain]++;
      }
    }
  }

  // Bước 4: Nếu vẫn chưa đủ (do domain nào đó thiếu câu), bổ sung từ các domain khác
  if (selected.length < targetTotal) {
    const remaining = fisherYatesShuffle(
      available.filter(q => !selectedIds.has(q.id))
    );
    const needed = targetTotal - selected.length;
    const toAdd = remaining.slice(0, needed);
    for (const q of toAdd) {
      selected.push(q);
      selectedIds.add(q.id);
    }
  }

  // Tính metadata
  const finalDomainDist = { hardware: 0, software: 0, networking: 0 };
  const finalTypeDist = { 'single-choice': 0, 'true-false': 0, 'multiple-choice': 0, 'drag-drop': 0 };
  const modulesSet = new Set();

  for (const q of selected) {
    if (finalDomainDist[q.domain] !== undefined) {
      finalDomainDist[q.domain]++;
    }
    if (finalTypeDist[q.type] !== undefined) {
      finalTypeDist[q.type]++;
    }
    if (q.module) {
      modulesSet.add(q.module);
    }
  }

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    totalQuestions: selected.length,
    timeLimit,
    questions: selected,
    domainDistribution: finalDomainDist,
    typeDistribution: finalTypeDist,
    modulesCovered: Array.from(modulesSet).sort(),
    ...(warning ? { warning } : {})
  };
}

/**
 * Xáo trộn thứ tự câu hỏi và đáp án
 * - Xáo trộn thứ tự câu hỏi
 * - Với single-choice: xáo trộn options và điều chỉnh correct index
 * - Với true-false: KHÔNG xáo trộn options
 * - Với multiple-choice: xáo trộn options và điều chỉnh correct array
 * - Với drag-drop: KHÔNG xáo trộn options (thứ tự quan trọng)
 * @param {Object[]} questions
 * @returns {Object[]} Câu hỏi đã xáo trộn (mảng mới)
 */
function shuffleExam(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  // Xáo trộn thứ tự câu hỏi
  const shuffledQuestions = fisherYatesShuffle(questions);

  // Xáo trộn đáp án cho từng câu hỏi
  return shuffledQuestions.map(q => {
    const cloned = { ...q, options: [...q.options] };

    if (q.type === 'single-choice') {
      // Xáo trộn options và điều chỉnh correct index
      const correctValue = q.options[q.correct];
      const indices = q.options.map((_, i) => i);
      const shuffledIndices = fisherYatesShuffle(indices);
      cloned.options = shuffledIndices.map(i => q.options[i]);
      cloned.correct = cloned.options.indexOf(correctValue);
    } else if (q.type === 'multiple-choice') {
      // Xáo trộn options và điều chỉnh correct array
      const correctValues = Array.isArray(q.correct)
        ? q.correct.map(i => q.options[i])
        : [q.options[q.correct]];
      const indices = q.options.map((_, i) => i);
      const shuffledIndices = fisherYatesShuffle(indices);
      cloned.options = shuffledIndices.map(i => q.options[i]);
      cloned.correct = correctValues.map(val => cloned.options.indexOf(val));
    }
    // true-false và drag-drop: giữ nguyên options

    return cloned;
  });
}

module.exports = { generateExam, shuffleExam };
