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

module.exports = { validateImportedQuestion, validateBatch };
