/**
 * Rate limiter in-memory cho API xác thực
 * Sử dụng Map lưu trữ số lần thử sai theo IP
 *
 * @module rateLimiter
 */

/**
 * Tạo middleware rate limiter cho Express
 * @param {Object} [options]
 * @param {number} [options.maxAttempts=5] - Số lần thử tối đa trong window
 * @param {number} [options.windowMs=300000] - Thời gian window (ms), mặc định 5 phút
 * @param {number} [options.blockMs=900000] - Thời gian block (ms), mặc định 15 phút
 * @returns {Function} Express middleware (req, res, next) => void
 */
function createRateLimiter(options = {}) {
  const {
    maxAttempts = 5,
    windowMs = 300000,
    blockMs = 900000
  } = options;

  // Map<string, { attempts: number, firstAttempt: number, blockedUntil: number }>
  const store = new Map();

  /**
   * Lấy IP từ request (hỗ trợ trust proxy)
   * @param {Object} req - Express request
   * @returns {string}
   */
  function getClientIp(req) {
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * Express middleware
   * @param {Object} req
   * @param {Object} res
   * @param {Function} next
   */
  function middleware(req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();
    let record = store.get(ip);

    // Nếu đang bị block
    if (record && record.blockedUntil > now) {
      const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        retryAfter
      });
    }

    // Nếu có record nhưng window đã hết hạn → reset
    if (record && (now - record.firstAttempt) > windowMs) {
      record = null;
      store.delete(ip);
    }

    // Cho phép request đi qua, đăng ký hook để track kết quả
    // Lưu hàm onFailedAttempt vào req để route handler gọi khi xác thực thất bại
    req.rateLimiter = {
      recordFailedAttempt() {
        let entry = store.get(ip);
        if (!entry || (now - entry.firstAttempt) > windowMs) {
          entry = { attempts: 0, firstAttempt: now, blockedUntil: 0 };
        }
        entry.attempts += 1;

        if (entry.attempts >= maxAttempts) {
          entry.blockedUntil = now + blockMs;
        }

        store.set(ip, entry);
      },
      resetAttempts() {
        store.delete(ip);
      }
    };

    next();
  }

  // Expose store for testing purposes
  middleware._store = store;

  return middleware;
}

module.exports = { createRateLimiter };
