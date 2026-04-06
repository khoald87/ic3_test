/**
 * Question Validator Module
 * Xác thực câu hỏi nhập từ bên ngoài
 */

/**
 * Xác thực một câu hỏi nhập từ bên ngoài
 * @param {Object} question - Câu hỏi cần xác thực
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateImportedQuestion(question) {
  const errors = [];

  if (question === null || question === undefined || typeof question !== 'object' || Array.isArray(question)) {
    return { valid: false, errors: ['Câu hỏi phải là một đối tượng hợp lệ'] };
  }

  // Check q field
  if (question.q === undefined || question.q === null) {
    errors.push('Thiếu trường bắt buộc: q');
  } else if (typeof question.q !== 'string' || question.q.trim() === '') {
    errors.push('Trường q phải là chuỗi không rỗng');
  }

  // Check options field
  if (question.options === undefined || question.options === null) {
    errors.push('Thiếu trường bắt buộc: options');
  } else if (!Array.isArray(question.options)) {
    errors.push('Trường options phải là một mảng');
  } else if (question.options.length < 3) {
    errors.push('Trường options phải có ít nhất 3 lựa chọn');
  }

  // Check correct field
  if (question.correct === undefined || question.correct === null) {
    errors.push('Thiếu trường bắt buộc: correct');
  } else if (typeof question.correct !== 'number' && !Array.isArray(question.correct)) {
    errors.push('Trường correct phải là số hoặc mảng số');
  } else if (Array.isArray(question.correct) && !question.correct.every(c => typeof c === 'number')) {
    errors.push('Trường correct phải là số hoặc mảng số');
  }

  // Check correct bounds (only if both options and correct are valid types)
  if (Array.isArray(question.options) && question.options.length >= 3 &&
      (typeof question.correct === 'number' || (Array.isArray(question.correct) && question.correct.every(c => typeof c === 'number')))) {
    const boundsResult = validateCorrectBounds(question);
    if (!boundsResult.valid) {
      errors.push(boundsResult.error);
    }
  }

  // Check source field
  if (question.source === undefined || question.source === null) {
    errors.push('Thiếu trường bắt buộc: source');
  } else if (typeof question.source !== 'string' || question.source.trim() === '') {
    errors.push('Trường source phải là chuỗi không rỗng');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Xác thực một mảng câu hỏi
 * @param {Object[]} questions - Mảng câu hỏi cần xác thực
 * @returns {{ valid: Object[], invalid: { question: Object, errors: string[] }[] }}
 */
function validateBatch(questions) {
  const valid = [];
  const invalid = [];

  if (!Array.isArray(questions)) {
    return { valid: [], invalid: [] };
  }

  for (const question of questions) {
    const result = validateImportedQuestion(question);
    if (result.valid) {
      valid.push(question);
    } else {
      invalid.push({ question, errors: result.errors });
    }
  }

  return { valid, invalid };
}

/**
 * Kiểm tra giá trị correct nằm trong phạm vi hợp lệ của options
 * @param {Object} question - Câu hỏi cần kiểm tra
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateCorrectBounds(question) {
  if (!question || !Array.isArray(question.options) || question.options.length === 0) {
    return { valid: false, error: 'Câu hỏi phải có mảng options hợp lệ' };
  }

  const len = question.options.length;
  const correct = question.correct;

  if (correct === undefined || correct === null) {
    return { valid: false, error: 'Thiếu trường correct' };
  }

  if (typeof correct === 'number') {
    if (!Number.isInteger(correct) || correct < 0 || correct >= len) {
      return { valid: false, error: `Giá trị correct (${correct}) phải là số nguyên từ 0 đến ${len - 1}` };
    }
    return { valid: true, error: null };
  }

  if (Array.isArray(correct)) {
    for (let i = 0; i < correct.length; i++) {
      const c = correct[i];
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c >= len) {
        return { valid: false, error: `Phần tử correct[${i}] (${c}) phải là số nguyên từ 0 đến ${len - 1}` };
      }
    }
    return { valid: true, error: null };
  }

  return { valid: false, error: 'Trường correct phải là số hoặc mảng số' };
}

// Enum constants for full question validation
const VALID_TYPES = new Set(['single-choice', 'true-false', 'multiple-choice', 'drag-drop']);
const VALID_DOMAINS = new Set(['hardware', 'software', 'networking']);
const VALID_MODULES = new Set(['module_1', 'module_2', 'module_3', 'module_4', 'module_5', 'module_6']);
const VALID_DIFFICULTIES = new Set(['dễ', 'trung bình', 'khó']);

/**
 * Validate đầy đủ một câu hỏi trong ngân hàng đề
 * Kiểm tra tất cả trường bắt buộc: id, q, type, options, correct, explanation, difficulty, domain, module
 * @param {Object} question - Câu hỏi cần validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFullQuestion(question) {
  const errors = [];

  if (question === null || question === undefined || typeof question !== 'object' || Array.isArray(question)) {
    return { valid: false, errors: ['Câu hỏi phải là một đối tượng hợp lệ'] };
  }

  // Check id
  if (question.id === undefined || question.id === null) {
    errors.push('Thiếu trường bắt buộc: id');
  } else if (typeof question.id !== 'string' || question.id.trim() === '') {
    errors.push('Trường id phải là chuỗi không rỗng');
  }

  // Check q
  if (question.q === undefined || question.q === null) {
    errors.push('Thiếu trường bắt buộc: q');
  } else if (typeof question.q !== 'string' || question.q.trim() === '') {
    errors.push('Trường q phải là chuỗi không rỗng');
  }

  // Check type
  if (question.type === undefined || question.type === null) {
    errors.push('Thiếu trường bắt buộc: type');
  } else if (!VALID_TYPES.has(question.type)) {
    errors.push(`Giá trị type không hợp lệ: "${question.type}". Phải là một trong: ${[...VALID_TYPES].join(', ')}`);
  }

  // Check options
  if (question.options === undefined || question.options === null) {
    errors.push('Thiếu trường bắt buộc: options');
  } else if (!Array.isArray(question.options)) {
    errors.push('Trường options phải là một mảng');
  } else if (question.options.length < 2) {
    errors.push('Trường options phải có ít nhất 2 lựa chọn');
  }

  // Check correct
  if (question.correct === undefined || question.correct === null) {
    errors.push('Thiếu trường bắt buộc: correct');
  } else if (typeof question.correct !== 'number' && !Array.isArray(question.correct)) {
    errors.push('Trường correct phải là số hoặc mảng số');
  } else if (Array.isArray(question.correct) && !question.correct.every(c => typeof c === 'number')) {
    errors.push('Trường correct phải là số hoặc mảng số');
  }

  // Check correct bounds (only if both options and correct are valid types)
  if (Array.isArray(question.options) && question.options.length >= 2 &&
      (typeof question.correct === 'number' || (Array.isArray(question.correct) && question.correct.every(c => typeof c === 'number')))) {
    const boundsResult = validateCorrectBounds(question);
    if (!boundsResult.valid) {
      errors.push(boundsResult.error);
    }
  }

  // Check explanation
  if (question.explanation === undefined || question.explanation === null) {
    errors.push('Thiếu trường bắt buộc: explanation');
  } else if (typeof question.explanation !== 'string' || question.explanation.trim() === '') {
    errors.push('Trường explanation phải là chuỗi không rỗng');
  }

  // Check difficulty
  if (question.difficulty === undefined || question.difficulty === null) {
    errors.push('Thiếu trường bắt buộc: difficulty');
  } else if (!VALID_DIFFICULTIES.has(question.difficulty)) {
    errors.push(`Giá trị difficulty không hợp lệ: "${question.difficulty}". Phải là một trong: ${[...VALID_DIFFICULTIES].join(', ')}`);
  }

  // Check domain
  if (question.domain === undefined || question.domain === null) {
    errors.push('Thiếu trường bắt buộc: domain');
  } else if (!VALID_DOMAINS.has(question.domain)) {
    errors.push(`Giá trị domain không hợp lệ: "${question.domain}". Phải là một trong: ${[...VALID_DOMAINS].join(', ')}`);
  }

  // Check module
  if (question.module === undefined || question.module === null) {
    errors.push('Thiếu trường bắt buộc: module');
  } else if (!VALID_MODULES.has(question.module)) {
    errors.push(`Giá trị module không hợp lệ: "${question.module}". Phải là một trong: ${[...VALID_MODULES].join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate toàn bộ ngân hàng câu hỏi
 * @param {Object[]} questions - Mảng câu hỏi cần validate
 * @returns {{ valid: number, invalid: { index: number, id: string, errors: string[] }[] }}
 */
function validateQuestionBank(questions) {
  if (!Array.isArray(questions)) {
    return { valid: 0, invalid: [] };
  }

  let validCount = 0;
  const invalid = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const result = validateFullQuestion(question);
    if (result.valid) {
      validCount++;
    } else {
      invalid.push({
        index: i,
        id: (question && typeof question === 'object' && !Array.isArray(question) && question.id) ? String(question.id) : 'unknown',
        errors: result.errors
      });
    }
  }

  return { valid: validCount, invalid };
}

module.exports = {
  validateImportedQuestion,
  validateBatch,
  validateCorrectBounds,
  validateFullQuestion,
  validateQuestionBank,
  VALID_TYPES,
  VALID_DOMAINS,
  VALID_MODULES,
  VALID_DIFFICULTIES
};
