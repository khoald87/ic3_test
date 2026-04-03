import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit tests cho Router Module
 * Vì router.js là browser-side IIFE, ta test logic parsing trực tiếp
 */

// Simulate window + hashchange cho router
const hashchangeListeners = [];

function loadRouter() {
  // Reset
  delete globalThis.window?.Router;
  hashchangeListeners.length = 0;
  
  // Ensure window exists with location
  if (!globalThis.window) globalThis.window = {};
  globalThis.window.location = { hash: '' };
  
  // Override addEventListener to capture hashchange listeners
  globalThis.window.addEventListener = function (event, fn) {
    if (event === 'hashchange') {
      hashchangeListeners.push(fn);
    }
  };

  // Load the module by evaluating it
  const fs = require('fs');
  const path = require('path');
  const code = fs.readFileSync(path.join(__dirname, '../../public/router.js'), 'utf-8');
  eval(code);

  return globalThis.window.Router;
}

function triggerHashChange() {
  hashchangeListeners.forEach(fn => fn());
}

describe('Router Module', () => {
  let Router;

  beforeEach(() => {
    Router = loadRouter();
  });

  afterEach(() => {
    globalThis.window.location.hash = '';
  });

  describe('getCurrentRoute', () => {
    it('trả về dashboard cho hash rỗng', () => {
      globalThis.window.location.hash = '';
      const route = Router.getCurrentRoute();
      expect(route.name).toBe('dashboard');
      expect(route.params).toEqual({});
    });

    it('trả về dashboard cho #/', () => {
      globalThis.window.location.hash = '#/';
      const route = Router.getCurrentRoute();
      expect(route.name).toBe('dashboard');
    });

    it('trả về exam cho #/exam', () => {
      globalThis.window.location.hash = '#/exam';
      const route = Router.getCurrentRoute();
      expect(route.name).toBe('exam');
      expect(route.params).toEqual({});
    });

    it('trả về history cho #/history', () => {
      globalThis.window.location.hash = '#/history';
      const route = Router.getCurrentRoute();
      expect(route.name).toBe('history');
    });

    it('parse moduleId từ #/review/module_1', () => {
      globalThis.window.location.hash = '#/review/module_1';
      const route = Router.getCurrentRoute();
      expect(route.name).toBe('review');
      expect(route.params.moduleId).toBe('module_1');
    });

    it('parse examId từ #/history/exam_123', () => {
      globalThis.window.location.hash = '#/history/exam_123';
      const route = Router.getCurrentRoute();
      expect(route.name).toBe('historyDetail');
      expect(route.params.examId).toBe('exam_123');
    });

    it('fallback dashboard cho route không hợp lệ', () => {
      globalThis.window.location.hash = '#/unknown/path/deep';
      const route = Router.getCurrentRoute();
      expect(route.name).toBe('dashboard');
    });
  });

  describe('navigateTo', () => {
    it('thay đổi hash', () => {
      Router.navigateTo('#/exam');
      expect(globalThis.window.location.hash).toBe('#/exam');
    });
  });

  describe('onRouteChange', () => {
    it('đăng ký callback và gọi khi hashchange', () => {
      const callback = vi.fn();
      Router.onRouteChange(callback);
      
      globalThis.window.location.hash = '#/exam';
      triggerHashChange();
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'exam' })
      );
    });

    it('trả về unsubscribe function', () => {
      const callback = vi.fn();
      const unsub = Router.onRouteChange(callback);
      
      unsub();
      triggerHashChange();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('không crash khi callback throw error', () => {
      const badCallback = vi.fn(() => { throw new Error('test'); });
      const goodCallback = vi.fn();
      
      Router.onRouteChange(badCallback);
      Router.onRouteChange(goodCallback);
      
      expect(() => {
        triggerHashChange();
      }).not.toThrow();
      
      expect(goodCallback).toHaveBeenCalled();
    });
  });
});
