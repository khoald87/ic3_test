const fs = require('fs');
const path = require('path');

const STUDENTS_FILE = path.join(__dirname, '..', 'data', 'students.json');

/**
 * Đọc file students.json, tự tạo nếu chưa tồn tại
 * @returns {Object}
 */
function readStudentsFile() {
  try {
    if (!fs.existsSync(STUDENTS_FILE)) {
      const initial = { students: {} };
      fs.writeFileSync(STUDENTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const data = fs.readFileSync(STUDENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw e;
    }
    const initial = { students: {} };
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

/**
 * Ghi file students.json
 * @param {Object} data
 */
function writeStudentsFile(data) {
  fs.writeFileSync(STUDENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
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
 * Validate tên học sinh: 2-50 ký tự sau trim, không chỉ whitespace
 * @param {string} name
 * @returns {boolean}
 */
function validateStudentName(name) {
  if (typeof name !== 'string') return false;
  var trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  if (/^\s+$/.test(trimmed)) return false;
  return true;
}

/**
 * Lưu kết quả thi cho học sinh
 * @param {string} studentName
 * @param {Object} result
 * @returns {{ success: boolean }}
 */
function saveExamResult(studentName, result) {
  var db = readStudentsFile();
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
  writeStudentsFile(db);
  return { success: true };
}

/**
 * Lưu tiến trình ôn tập
 * @param {string} studentName
 * @param {string} moduleId
 * @param {string} questionId
 * @param {boolean} isCorrect
 * @returns {{ success: boolean }}
 */
function saveReviewProgress(studentName, moduleId, questionId, isCorrect) {
  var db = readStudentsFile();
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
  writeStudentsFile(db);
  return { success: true };
}

/**
 * Lấy danh sách học sinh với thống kê
 * @returns {Array}
 */
function getStudentList() {
  var db = readStudentsFile();
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
 * Lấy lịch sử thi của học sinh
 * @param {string} name
 * @returns {Array}
 */
function getStudentHistory(name) {
  var db = readStudentsFile();
  var key = normalizeStudentName(name);
  var student = db.students[key];
  if (!student) return [];
  return student.examHistory || [];
}

/**
 * Lấy tiến trình ôn tập của học sinh
 * @param {string} name
 * @returns {Object}
 */
function getStudentProgress(name) {
  var db = readStudentsFile();
  var key = normalizeStudentName(name);
  var student = db.students[key];
  if (!student) return {};
  return student.reviewProgress || {};
}

/**
 * Xóa dữ liệu 1 học sinh
 * @param {string} name
 * @returns {{ success: boolean, deleted: number }}
 */
function deleteStudent(name) {
  var db = readStudentsFile();
  var key = normalizeStudentName(name);
  if (db.students[key]) {
    delete db.students[key];
    writeStudentsFile(db);
    return { success: true, deleted: 1 };
  }
  return { success: true, deleted: 0 };
}

/**
 * Xóa tất cả dữ liệu học sinh
 * @returns {{ success: boolean, deleted: number }}
 */
function deleteAllStudents() {
  var db = readStudentsFile();
  var count = Object.keys(db.students).length;
  db.students = {};
  writeStudentsFile(db);
  return { success: true, deleted: count };
}

module.exports = {
  readStudentsFile,
  writeStudentsFile,
  normalizeStudentName,
  validateStudentName,
  saveExamResult,
  saveReviewProgress,
  getStudentList,
  getStudentHistory,
  getStudentProgress,
  deleteStudent,
  deleteAllStudents
};
