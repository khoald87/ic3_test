import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRateLimiter } from '../../src/rateLimiter.js';

/**
 * Helper: tạo mock req/res/next cho Express middleware
 */
function createMockReqRes(ip = '127.0.0.1') {
  const req = {
    ip,
    connection: { remoteAddress: ip },
    rateLimiter: null
  };
  const res = {
    _status: null,
    _json: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(data) { this._json = data; return this; },
    set(key, val) { this._headers[key] = val; return this; }
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('rateLimiter', () => {
  describe('createRateLimiter', () => {
    it('should return a function (middleware)', () => {
      const mw = createRateLimiter();
      expect(typeof mw).toBe('function');
    });

    it('should allow requests under the limit', () => {
      const mw = createRateLimiter({ maxAttempts: 3, windowMs: 60000, blockMs: 60000 });
      const { req, res, next } = createMockReqRes();

      mw(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res._status).toBeNull();
      expect(req.rateLimiter).toBeTruthy();
    });

    it('should block IP after maxAttempts failed attempts', () => {
      const mw = createRateLimiter({ maxAttempts: 3, windowMs: 60000, blockMs: 60000 });

      // Simulate 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const { req, res, next } = createMockReqRes('10.0.0.1');
        mw(req, res, next);
        req.rateLimiter.recordFailedAttempt();
      }

      // 4th request should be blocked
      const { req, res, next } = createMockReqRes('10.0.0.1');
      mw(req, res, next);
      expect(res._status).toBe(429);
      expect(res._json.error).toContain('Quá nhiều yêu cầu');
      expect(next).not.toHaveBeenCalled();
    });

    it('should not block different IPs', () => {
      const mw = createRateLimiter({ maxAttempts: 2, windowMs: 60000, blockMs: 60000 });

      // Block IP1
      for (let i = 0; i < 2; i++) {
        const { req, res, next } = createMockReqRes('10.0.0.1');
        mw(req, res, next);
        req.rateLimiter.recordFailedAttempt();
      }

      // IP2 should still be allowed
      const { req, res, next } = createMockReqRes('10.0.0.2');
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res._status).toBeNull();
    });

    it('should reset attempts after window expires', () => {
      const mw = createRateLimiter({ maxAttempts: 3, windowMs: 100, blockMs: 60000 });

      // Record 2 failed attempts
      const { req: req1, res: res1, next: next1 } = createMockReqRes('10.0.0.3');
      mw(req1, res1, next1);
      req1.rateLimiter.recordFailedAttempt();
      req1.rateLimiter.recordFailedAttempt();

      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          const { req, res, next } = createMockReqRes('10.0.0.3');
          mw(req, res, next);
          expect(next).toHaveBeenCalled();
          expect(res._status).toBeNull();
          resolve();
        }, 150);
      });
    });

    it('should include Retry-After header when blocked', () => {
      const mw = createRateLimiter({ maxAttempts: 1, windowMs: 60000, blockMs: 30000 });

      // Trigger block
      const { req: req1, res: res1, next: next1 } = createMockReqRes('10.0.0.4');
      mw(req1, res1, next1);
      req1.rateLimiter.recordFailedAttempt();

      // Blocked request
      const { req, res, next } = createMockReqRes('10.0.0.4');
      mw(req, res, next);
      expect(res._status).toBe(429);
      expect(res._headers['Retry-After']).toBeDefined();
      expect(Number(res._headers['Retry-After'])).toBeGreaterThan(0);
    });

    it('should reset attempts on successful auth via resetAttempts', () => {
      const mw = createRateLimiter({ maxAttempts: 3, windowMs: 60000, blockMs: 60000 });

      // Record 2 failed attempts
      const { req: req1, res: res1, next: next1 } = createMockReqRes('10.0.0.5');
      mw(req1, res1, next1);
      req1.rateLimiter.recordFailedAttempt();
      req1.rateLimiter.recordFailedAttempt();

      // Successful auth resets
      const { req: req2, res: res2, next: next2 } = createMockReqRes('10.0.0.5');
      mw(req2, res2, next2);
      req2.rateLimiter.resetAttempts();

      // Should be allowed again (counter reset)
      for (let i = 0; i < 2; i++) {
        const { req, res, next } = createMockReqRes('10.0.0.5');
        mw(req, res, next);
        expect(next).toHaveBeenCalled();
        req.rateLimiter.recordFailedAttempt();
      }
    });

    it('should use default options when none provided', () => {
      const mw = createRateLimiter();
      const { req, res, next } = createMockReqRes();
      mw(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
