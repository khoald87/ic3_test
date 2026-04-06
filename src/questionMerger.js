/**
 * Question Merger Module
 * Gộp câu hỏi từ new_questions_*.json vào questions.json khi startup
 */

const fs = require('fs');
const path = require('path');

/**
 * Gộp câu hỏi từ tất cả file new_questions_*.json vào questions.json
 * @param {string} dataDir - đường dẫn thư mục data
 * @param {Function} validateFn - hàm validate câu hỏi, trả về { valid: boolean, errors: string[] }
 * @returns {Promise<{ added: number, skipped: number, invalid: number }>}
 */
async function mergeNewQuestions(dataDir, validateFn) {
  const result = { added: 0, skipped: 0, invalid: 0 };

  // Read existing questions.json
  const questionsPath = path.join(dataDir, 'questions.json');
  let db;
  try {
    const raw = await fs.promises.readFile(questionsPath, 'utf8');
    db = JSON.parse(raw);
  } catch (err) {
    // If questions.json doesn't exist or is corrupted, start with empty
    db = { modules: [], questions: [] };
  }

  if (!Array.isArray(db.questions)) {
    db.questions = [];
  }

  // Build a Set of existing question IDs for fast lookup
  const existingIds = new Set(db.questions.map(q => q.id));

  // Find all new_questions_*.json files
  let files;
  try {
    const allFiles = await fs.promises.readdir(dataDir);
    files = allFiles
      .filter(f => /^new_questions_.*\.json$/.test(f))
      .sort(); // Sort for deterministic order
  } catch (err) {
    // If dataDir doesn't exist or can't be read, return empty result
    return result;
  }

  // Process each new questions file
  for (const file of files) {
    const filePath = path.join(dataDir, file);
    let newQuestions;
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      // Support both array format and { questions: [...] } format
      newQuestions = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.questions) ? parsed.questions : []);
    } catch (err) {
      // Skip files that can't be read or parsed
      continue;
    }

    for (const question of newQuestions) {
      // Skip if no id
      if (!question || typeof question !== 'object' || !question.id) {
        result.invalid++;
        continue;
      }

      // Skip duplicate ids
      if (existingIds.has(question.id)) {
        result.skipped++;
        continue;
      }

      // Validate using provided validation function
      const validation = validateFn(question);
      if (!validation.valid) {
        result.invalid++;
        continue;
      }

      // Add valid, non-duplicate question
      db.questions.push(question);
      existingIds.add(question.id);
      result.added++;
    }
  }

  // Write updated questions.json only if new questions were added
  if (result.added > 0) {
    await fs.promises.writeFile(questionsPath, JSON.stringify(db, null, 2), 'utf8');
  }

  return result;
}

module.exports = { mergeNewQuestions };
