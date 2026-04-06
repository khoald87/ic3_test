const fs = require('fs');
const path = require('path');

const STUDENTS_FILE = path.join(__dirname, '..', 'data', 'students.json');

/**
 * Đọc file students.json (async), tự tạo nếu chưa tồn tại
 * @returns {Promise<Object>}
 */
async function readStudentsFile() {
  try {
    try {
      await fs.promises.access(STUDENTS_FILE);
    } catch {
      const initial = { students: {} };
      await fs.promises.writeFile(STUDENTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const data = await fs.promises.readFile(STUDENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw e;
    }
    const initial = { students: {} };
    await fs.promises.writeFile(STUDENTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

/**
 * Ghi file students.json (async)
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function writeStudentsFile(data) {
  await fs.promises.writeFile(STUDENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Chuẩn hóa tên học sinh: trim + toLowerCase
 * @param {string} name
 * @returns {string}
 */
function normalizeStudentName(name) {
  return name.trim().toLowerCase();
}

/**
 * Kiểm tra chuỗi có chứa path traversal sequences không
 * @param {string} str
 * @returns {boolean} true nếu chứa path traversal
 */
function containsPathTraversal(str) {
  // Check for ../, ./, ..\ , .\
  if (str.indexOf('../') !== -1) return true;
  if (str.indexOf('./') !== -1) return true;
  if (str.indexOf('..\\') !== -1) return true;
  if (str.indexOf('.\\') !== -1) return true;
  return false;
}

/**
 * Kiểm tra chuỗi có chứa ký tự điều khiển không (code point < 32, trừ space)
 * Bao gồm null bytes (\0)
 * @param {string} str
 * @returns {boolean} true nếu chứa ký tự điều khiển
 */
function containsControlCharacters(str) {
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code < 32) return true; // code point < 32 (space is 32, so excluded)
  }
  return false;
}

/**
 * Validate tên học sinh: 2-50 ký tự sau trim, không chỉ whitespace,
 * không chứa path traversal sequences hoặc ký tự điều khiển
 * @param {string} name
 * @returns {boolean}
 */
function validateStudentName(name) {
  if (typeof name !== 'string') return false;
  var trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  if (/^\s+$/.test(trimmed)) return false;
  if (containsPathTraversal(trimmed)) return false;
  if (containsControlCharacters(trimmed)) return false;
  return true;
}

/**
 * Lưu kết quả thi cho học sinh (async)
 * @param {string} studentName
 * @param {Object} result
 * @returns {Promise<{ success: boolean }>}
 */
async function saveExamResult(studentName, result) {
  var db = await readStudentsFile();
  var key = normalizeStudentName(studentName);
  var displayName = studentName.trim();

  if (!db.students[key]) {
    db.students[key] = {
      displayName: displayName,
      examHistory: [],
      reviewProgress: {},
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };
  }

  db.students[key].examHistory.push(result);
  db.students[key].lastActiveAt = new Date().toISOString();
  db.students[key].displayName = displayName;
  await writeStudentsFile(db);
  return { success: true };
}

/**
 * Lưu tiến trình ôn tập (async)
 * @param {string} studentName
 * @param {string} moduleId
 * @param {string} questionId
 * @param {boolean} isCorrect
 * @returns {Promise<{ success: boolean }>}
 */
async function saveReviewProgress(studentName, moduleId, questionId, isCorrect) {
  var db = await readStudentsFile();
  var key = normalizeStudentName(studentName);
  var displayName = studentName.trim();

  if (!db.students[key]) {
    db.students[key] = {
      displayName: displayName,
      examHistory: [],
      reviewProgress: {},
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    };
  }

  if (!db.students[key].reviewProgress[moduleId]) {
    db.students[key].reviewProgress[moduleId] = {
      answeredCorrectly: [],
      lastAttemptDate: new Date().toISOString()
    };
  }

  var mod = db.students[key].reviewProgress[moduleId];
  mod.lastAttemptDate = new Date().toISOString();

  if (isCorrect && mod.answeredCorrectly.indexOf(questionId) === -1) {
    mod.answeredCorrectly.push(questionId);
  }

  db.students[key].lastActiveAt = new Date().toISOString();
  await writeStudentsFile(db);
  return { success: true };
}

/**
 * Lấy danh sách học sinh với thống kê (async)
 * @returns {Promise<Array>}
 */
async function getStudentList() {
  var db = await readStudentsFile();
  var list = [];

  var keys = Object.keys(db.students);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var student = db.students[key];
    var examCount = student.examHistory ? student.examHistory.length : 0;
    var averageScore = 0;

    if (examCount > 0) {
      var totalScore = 0;
      for (var j = 0; j < student.examHistory.length; j++) {
        totalScore += student.examHistory[j].score || 0;
      }
      averageScore = Math.round(totalScore / examCount);
    }

    var lastExamDate = null;
    if (examCount > 0) {
      lastExamDate = student.examHistory[examCount - 1].date || null;
    }

    list.push({
      name: key,
      displayName: student.displayName || key,
      examCount: examCount,
      averageScore: averageScore,
      lastExamDate: lastExamDate,
      createdAt: student.createdAt,
      lastActiveAt: student.lastActiveAt
    });
  }

  return list;
}

/**
 * Lấy lịch sử thi của học sinh (async)
 * @param {string} name
 * @returns {Promise<Array>}
 */
async function getStudentHistory(name) {
  var db = await readStudentsFile();
  var key = normalizeStudentName(name);
  var student = db.students[key];
  if (!student) return [];
  return student.examHistory || [];
}

/**
 * Lấy tiến trình ôn tập của học sinh (async)
 * @param {string} name
 * @returns {Promise<Object>}
 */
async function getStudentProgress(name) {
  var db = await readStudentsFile();
  var key = normalizeStudentName(name);
  var student = db.students[key];
  if (!student) return {};
  return student.reviewProgress || {};
}

/**
 * Xóa dữ liệu 1 học sinh (async)
 * @param {string} name
 * @returns {Promise<{ success: boolean, deleted: number }>}
 */
async function deleteStudent(name) {
  var db = await readStudentsFile();
  var key = normalizeStudentName(name);
  if (db.students[key]) {
    delete db.students[key];
    await writeStudentsFile(db);
    return { success: true, deleted: 1 };
  }
  return { success: true, deleted: 0 };
}

/**
 * Xóa tất cả dữ liệu học sinh (async)
 * @returns {Promise<{ success: boolean, deleted: number }>}
 */
async function deleteAllStudents() {
  var db = await readStudentsFile();
  var count = Object.keys(db.students).length;
  db.students = {};
  await writeStudentsFile(db);
  return { success: true, deleted: count };
}

module.exports = {
  readStudentsFile,
  writeStudentsFile,
  normalizeStudentName,
  validateStudentName,
  containsPathTraversal,
  containsControlCharacters,
  saveExamResult,
  saveReviewProgress,
  getStudentList,
  getStudentHistory,
  getStudentProgress,
  deleteStudent,
  deleteAllStudents
};
