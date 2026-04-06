const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateImportedQuestion, validateBatch, validateFullQuestion, validateQuestionBank } = require('./src/validator.js');
const { mergeNewQuestions } = require('./src/questionMerger.js');
const { generateExam, shuffleExam } = require('./src/examGenerator.js');
const adminAuth = require('./src/adminAuth.js');
const studentManager = require('./src/studentManager.js');
const { createRateLimiter } = require('./src/rateLimiter.js');

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
 * Custom error class for corrupted/unparseable questions.json
 */
class QuestionsParseError extends Error {
    constructor(cause) {
        super('Không thể đọc dữ liệu câu hỏi: file JSON bị hỏng');
        this.name = 'QuestionsParseError';
        this.cause = cause;
    }
}

/**
 * Helper: đọc questions.json (async)
 * Throws QuestionsParseError if JSON is corrupted/unparseable
 */
async function readQuestionsFile() {
    try {
        const data = await fs.promises.readFile(QUESTIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err instanceof SyntaxError || err.code === 'ENOENT') {
            throw new QuestionsParseError(err);
        }
        throw err;
    }
}

/**
 * Helper: ghi questions.json (async)
 */
async function writeQuestionsFile(data) {
    await fs.promises.writeFile(QUESTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// CORS: restrict origins in production, allow all in development
if (process.env.NODE_ENV === 'production') {
    app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
} else {
    app.use(cors());
}
app.use(express.json());

// Security: trust proxy for Render.com reverse proxy
app.set('trust proxy', 1);

// Security: helmet with security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP to avoid breaking inline scripts in SPA
    xContentTypeOptions: true,    // X-Content-Type-Options: nosniff
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
    xXssProtection: true          // X-XSS-Protection: 1; mode=block (legacy browsers)
}));

// Health check endpoint (before static middleware so it's always accessible)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Rate limiter for PIN verification route
const verifyPinLimiter = createRateLimiter({
    maxAttempts: 5,
    windowMs: 300000,   // 5 minutes
    blockMs: 900000     // 15 minutes
});
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Sanitize student name from URL params — returns error message or null if valid
 * @param {string} name - decoded name from URL param
 * @returns {string|null} error message if invalid, null if valid
 */
function sanitizeStudentName(name) {
  if (!name || !studentManager.validateStudentName(name)) {
    return 'Tên học sinh không hợp lệ. Yêu cầu 2-50 ký tự, không chứa ký tự đặc biệt.';
  }
  return null;
}

// GET /api/questions — lọc câu hỏi theo module, difficulty, type
app.get('/api/questions', async (req, res) => {
    try {
        const db = await readQuestionsFile();
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
        if (error instanceof QuestionsParseError) {
            return res.status(503).json({ message: 'Dữ liệu câu hỏi tạm thời không khả dụng. Vui lòng thử lại sau.' });
        }
        res.status(500).json({ message: "Lỗi đọc dữ liệu máy chủ!" });
    }
});

// POST /api/questions/import — nhập câu hỏi từ bên ngoài (yêu cầu xác thực admin PIN)
app.post('/api/questions/import', async (req, res) => {
    try {
        // Xác thực admin PIN từ header
        const pin = req.headers['x-admin-pin'];
        if (!pin) {
            return res.status(401).json({ error: 'Yêu cầu xác thực mã PIN admin' });
        }
        const isAuthorized = await adminAuth.verifyPinAsync(pin);
        if (!isAuthorized) {
            return res.status(401).json({ error: 'Mã PIN admin không đúng' });
        }

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

        const db = await readQuestionsFile();

        // Auto-generate ID and ensure source label for each valid question
        const newQuestions = valid.map(q => ({
            ...q,
            id: q.id || `import_${crypto.randomUUID().slice(0, 8)}`,
            source: q.source || 'external'
        }));

        db.questions.push(...newQuestions);
        await writeQuestionsFile(db);

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
        if (error instanceof QuestionsParseError) {
            return res.status(503).json({ message: 'Dữ liệu câu hỏi tạm thời không khả dụng. Vui lòng thử lại sau.' });
        }
        res.status(500).json({ message: "Lỗi lưu dữ liệu câu hỏi!" });
    }
});

// GET /api/questions/stats — thống kê ngân hàng câu hỏi
app.get('/api/questions/stats', async (req, res) => {
    try {
        const db = await readQuestionsFile();
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
        if (error instanceof QuestionsParseError) {
            return res.status(503).json({ message: 'Dữ liệu câu hỏi tạm thời không khả dụng. Vui lòng thử lại sau.' });
        }
        res.status(500).json({ message: "Lỗi đọc dữ liệu máy chủ!" });
    }
});

// POST /api/exam/generate — tạo đề thi
app.post('/api/exam/generate', async (req, res) => {
    try {
        const db = await readQuestionsFile();
        const config = req.body || {};

        // Validate totalQuestions: must be integer in [1, 100]
        if (config.totalQuestions !== undefined) {
            const tq = config.totalQuestions;
            if (!Number.isInteger(tq) || tq < 1 || tq > 100) {
                console.warn(`[exam/generate] Invalid totalQuestions value: ${JSON.stringify(tq)}. Using default 45.`);
                config.totalQuestions = 45;
            }
        }

        const exam = generateExam(db.questions, config);
        exam.questions = shuffleExam(exam.questions);

        return res.status(200).json(exam);
    } catch (error) {
        if (error instanceof QuestionsParseError) {
            return res.status(503).json({ message: 'Dữ liệu câu hỏi tạm thời không khả dụng. Vui lòng thử lại sau.' });
        }
        res.status(500).json({ message: "Lỗi tạo đề thi!" });
    }
});

// ===== Auth Routes =====

// POST /api/auth/verify-pin
app.post('/api/auth/verify-pin', verifyPinLimiter, async (req, res) => {
    try {
        const { pin } = req.body || {};
        if (!pin) {
            if (req.rateLimiter) req.rateLimiter.recordFailedAttempt();
            return res.status(200).json({ success: false, message: 'Mã PIN không đúng' });
        }
        const result = await adminAuth.verifyPinAsync(pin);
        if (!result && req.rateLimiter) {
            req.rateLimiter.recordFailedAttempt();
        } else if (result && req.rateLimiter) {
            req.rateLimiter.resetAttempts();
        }
        return res.status(200).json({ success: result, message: result ? 'Xác thực thành công' : 'Mã PIN không đúng' });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// POST /api/auth/change-pin
app.post('/api/auth/change-pin', async (req, res) => {
    try {
        const { currentPin, newPin } = req.body || {};
        if (!currentPin || !newPin) {
            return res.status(400).json({ error: 'Thiếu trường bắt buộc' });
        }
        const isValid = await adminAuth.verifyPinAsync(currentPin);
        if (!isValid) {
            return res.status(401).json({ error: 'Mã PIN hiện tại không đúng' });
        }
        if (!adminAuth.validatePinFormat(newPin)) {
            return res.status(400).json({ error: 'Mã PIN phải gồm 4-6 chữ số' });
        }
        const result = await adminAuth.changePin(currentPin, newPin);
        return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// ===== Student Routes =====

// POST /api/students/save-result
app.post('/api/students/save-result', async (req, res) => {
    try {
        const { studentName, result } = req.body || {};
        if (!studentName || !studentManager.validateStudentName(studentName)) {
            return res.status(400).json({ error: 'Tên học sinh không hợp lệ. Yêu cầu 2-50 ký tự.' });
        }
        if (!result || !result.examId || result.score === undefined || !result.totalQuestions || result.correctCount === undefined) {
            return res.status(400).json({ error: 'Thiếu trường bắt buộc trong kết quả thi' });
        }
        await studentManager.saveExamResult(studentName, result);
        return res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// POST /api/students/save-progress
app.post('/api/students/save-progress', async (req, res) => {
    try {
        const { studentName, moduleId, questionId, isCorrect } = req.body || {};
        if (!studentName || !studentManager.validateStudentName(studentName)) {
            return res.status(400).json({ error: 'Tên học sinh không hợp lệ. Yêu cầu 2-50 ký tự.' });
        }
        if (!moduleId || !questionId) {
            return res.status(400).json({ error: 'Thiếu trường bắt buộc: moduleId, questionId' });
        }
        await studentManager.saveReviewProgress(studentName, moduleId, questionId, !!isCorrect);
        return res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// GET /api/students
app.get('/api/students', async (req, res) => {
    try {
        const list = await studentManager.getStudentList();
        return res.status(200).json({ students: list });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// GET /api/students/:name/history
app.get('/api/students/:name/history', async (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name);
        const error = sanitizeStudentName(name);
        if (error) {
            return res.status(400).json({ error: error });
        }
        const history = await studentManager.getStudentHistory(name);
        return res.status(200).json({ history: history });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// GET /api/students/:name/progress
app.get('/api/students/:name/progress', async (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name);
        const error = sanitizeStudentName(name);
        if (error) {
            return res.status(400).json({ error: error });
        }
        const progress = await studentManager.getStudentProgress(name);
        return res.status(200).json({ progress: progress });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// DELETE /api/students/:name
app.delete('/api/students/:name', async (req, res) => {
    try {
        const pin = req.headers['x-admin-pin'];
        if (!pin || !(await adminAuth.verifyPinAsync(pin))) {
            return res.status(401).json({ error: 'Yêu cầu xác thực mã PIN' });
        }
        const name = decodeURIComponent(req.params.name);
        const error = sanitizeStudentName(name);
        if (error) {
            return res.status(400).json({ error: error });
        }
        const result = await studentManager.deleteStudent(name);
        return res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// DELETE /api/students
app.delete('/api/students', async (req, res) => {
    try {
        const pin = req.headers['x-admin-pin'];
        if (!pin || !(await adminAuth.verifyPinAsync(pin))) {
            return res.status(401).json({ error: 'Yêu cầu xác thực mã PIN' });
        }
        const result = await studentManager.deleteAllStudents();
        return res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

/**
 * Startup initialization — runs before server starts listening
 * Order: migrate PIN → merge new questions → validate question bank
 */
async function startup() {
    const dataDir = path.join(__dirname, 'data');

    // 1. Migrate plaintext PIN to bcrypt hash if needed
    await adminAuth.migratePinIfNeeded();

    // 2. Merge new questions from new_questions_*.json files
    try {
        const mergeResult = await mergeNewQuestions(dataDir, validateFullQuestion);
        console.log(`[startup] Đã gộp ${mergeResult.added} câu hỏi mới (bỏ qua: ${mergeResult.skipped} trùng, ${mergeResult.invalid} không hợp lệ)`);
    } catch (err) {
        console.error('[startup] Lỗi khi gộp câu hỏi mới:', err.message);
    }

    // 3. Validate entire question bank
    try {
        const data = await fs.promises.readFile(QUESTIONS_FILE, 'utf8');
        const db = JSON.parse(data);
        const bankResult = validateQuestionBank(db.questions || []);
        console.log(`[startup] Ngân hàng câu hỏi: ${bankResult.valid} câu hợp lệ, ${bankResult.invalid.length} câu có lỗi`);
        for (const item of bankResult.invalid) {
            console.warn(`[startup] ⚠ Câu hỏi "${item.id}" (index ${item.index}): ${item.errors.join(', ')}`);
        }
    } catch (err) {
        console.error('[startup] Lỗi khi validate ngân hàng câu hỏi:', err.message);
    }
}

startup().then(() => {
    app.listen(PORT, () => {
        console.log(`Server đang chạy tại http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error('[startup] Lỗi nghiêm trọng:', err);
    app.listen(PORT, () => {
        console.log(`Server đang chạy tại http://localhost:${PORT} (startup có lỗi)`);
    });
});

// Global error handlers — log errors and keep server running
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[unhandledRejection]', reason);
});

// Export for testing
module.exports = { app, QuestionsParseError };
