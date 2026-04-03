const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateImportedQuestion, validateBatch } = require('./src/validator.js');
const { generateExam, shuffleExam } = require('./src/examGenerator.js');
const adminAuth = require('./src/adminAuth.js');
const studentManager = require('./src/studentManager.js');

const app = express();
const PORT = process.env.PORT || 3000;

const QUESTIONS_FILE = path.join(__dirname, 'data', 'questions.json');

// Auto-create data files if they don't exist (for fresh deployments)
const ADMIN_CONFIG_FILE = path.join(__dirname, 'data', 'admin-config.json');
const STUDENTS_FILE = path.join(__dirname, 'data', 'students.json');
if (!fs.existsSync(ADMIN_CONFIG_FILE)) {
    fs.writeFileSync(ADMIN_CONFIG_FILE, JSON.stringify({ pin: '1234' }, null, 2), 'utf8');
}
if (!fs.existsSync(STUDENTS_FILE)) {
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify({ students: {} }, null, 2), 'utf8');
}

const VALID_MODULES = ['module_1', 'module_2', 'module_3', 'module_4', 'module_5', 'module_6'];
const VALID_DIFFICULTIES = ['dễ', 'trung bình', 'khó'];
const VALID_TYPES = ['single-choice', 'true-false', 'multiple-choice', 'drag-drop'];

/**
 * Helper: đọc questions.json
 */
function readQuestionsFile() {
    const data = fs.readFileSync(QUESTIONS_FILE, 'utf8');
    return JSON.parse(data);
}

/**
 * Helper: ghi questions.json
 */
function writeQuestionsFile(data) {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/questions — lọc câu hỏi theo module, difficulty, type
app.get('/api/questions', (req, res) => {
    try {
        const db = readQuestionsFile();
        const { module: mod, difficulty, type } = req.query;

        // Validate filter params
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

        if (mod) {
            questions = questions.filter(q => q.module === mod);
        }
        if (difficulty) {
            questions = questions.filter(q => q.difficulty === difficulty);
        }
        if (type) {
            questions = questions.filter(q => q.type === type);
        }

        if (hasFilters) {
            return res.status(200).json({ questions });
        }

        // No filters: return full data including modules
        return res.status(200).json(db);
    } catch (error) {
        res.status(500).json({ message: "Lỗi đọc dữ liệu máy chủ!" });
    }
});

// POST /api/questions/import — nhập câu hỏi từ bên ngoài
app.post('/api/questions/import', (req, res) => {
    try {
        const body = req.body;

        if (!body || (typeof body !== 'object')) {
            return res.status(400).json({ message: 'Dữ liệu JSON không hợp lệ' });
        }

        // Support single question or array
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

        // Auto-generate ID and ensure source label for each valid question
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

// GET /api/questions/stats — thống kê ngân hàng câu hỏi
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

        return res.status(200).json({
            total: questions.length,
            byModule,
            byDifficulty,
            byType
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi đọc dữ liệu máy chủ!" });
    }
});

// POST /api/exam/generate — tạo đề thi
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

// ===== Auth Routes =====

// POST /api/auth/verify-pin
app.post('/api/auth/verify-pin', (req, res) => {
    try {
        const { pin } = req.body || {};
        if (!pin) {
            return res.status(200).json({ success: false, message: 'Mã PIN không đúng' });
        }
        const result = adminAuth.verifyPin(pin);
        return res.status(200).json({ success: result, message: result ? 'Xác thực thành công' : 'Mã PIN không đúng' });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// POST /api/auth/change-pin
app.post('/api/auth/change-pin', (req, res) => {
    try {
        const { currentPin, newPin } = req.body || {};
        if (!currentPin || !newPin) {
            return res.status(400).json({ error: 'Thiếu trường bắt buộc' });
        }
        if (!adminAuth.verifyPin(currentPin)) {
            return res.status(401).json({ error: 'Mã PIN hiện tại không đúng' });
        }
        if (!adminAuth.validatePinFormat(newPin)) {
            return res.status(400).json({ error: 'Mã PIN phải gồm 4-6 chữ số' });
        }
        const result = adminAuth.changePin(currentPin, newPin);
        return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// ===== Student Routes =====

// POST /api/students/save-result
app.post('/api/students/save-result', (req, res) => {
    try {
        const { studentName, result } = req.body || {};
        if (!studentName || !studentManager.validateStudentName(studentName)) {
            return res.status(400).json({ error: 'Tên học sinh không hợp lệ. Yêu cầu 2-50 ký tự.' });
        }
        if (!result || !result.examId || result.score === undefined || !result.totalQuestions || result.correctCount === undefined) {
            return res.status(400).json({ error: 'Thiếu trường bắt buộc trong kết quả thi' });
        }
        studentManager.saveExamResult(studentName, result);
        return res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// POST /api/students/save-progress
app.post('/api/students/save-progress', (req, res) => {
    try {
        const { studentName, moduleId, questionId, isCorrect } = req.body || {};
        if (!studentName || !studentManager.validateStudentName(studentName)) {
            return res.status(400).json({ error: 'Tên học sinh không hợp lệ. Yêu cầu 2-50 ký tự.' });
        }
        if (!moduleId || !questionId) {
            return res.status(400).json({ error: 'Thiếu trường bắt buộc: moduleId, questionId' });
        }
        studentManager.saveReviewProgress(studentName, moduleId, questionId, !!isCorrect);
        return res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// GET /api/students
app.get('/api/students', (req, res) => {
    try {
        const list = studentManager.getStudentList();
        return res.status(200).json({ students: list });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// GET /api/students/:name/history
app.get('/api/students/:name/history', (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name);
        const history = studentManager.getStudentHistory(name);
        return res.status(200).json({ history: history });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// GET /api/students/:name/progress
app.get('/api/students/:name/progress', (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name);
        const progress = studentManager.getStudentProgress(name);
        return res.status(200).json({ progress: progress });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// DELETE /api/students/:name
app.delete('/api/students/:name', (req, res) => {
    try {
        const pin = req.headers['x-admin-pin'];
        if (!pin || !adminAuth.verifyPin(pin)) {
            return res.status(401).json({ error: 'Yêu cầu xác thực mã PIN' });
        }
        const name = decodeURIComponent(req.params.name);
        const result = studentManager.deleteStudent(name);
        return res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// DELETE /api/students
app.delete('/api/students', (req, res) => {
    try {
        const pin = req.headers['x-admin-pin'];
        if (!pin || !adminAuth.verifyPin(pin)) {
            return res.status(401).json({ error: 'Yêu cầu xác thực mã PIN' });
        }
        const result = studentManager.deleteAllStudents();
        return res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
