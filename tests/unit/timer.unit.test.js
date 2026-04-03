import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit tests cho Timer Module
 */

function loadTimer() {
  delete globalThis.window?.Timer;
  if (!globalThis.window) globalThis.window = {};

  const fs = require('fs');
  const path = require('path');
  const code = fs.readFileSync(path.join(__dirname, '../../public/timer.js'), 'utf-8');
  eval(code);

  return globalThis.window.Timer;
}

describe('Timer Module', () => {
  let Timer;

  beforeEach(() => {
    vi.useFakeTimers();
    Timer = loadTimer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createTimer', () => {
    it('tạo timer với duration đúng', () => {
      const timer = Timer.createTimer(50, () => {}, () => {});
      expect(timer.getRemaining()).toBe(3000); // 50 * 60
    });

    it('tạo timer 1 phút = 60 giây', () => {
      const timer = Timer.createTimer(1, () => {}, () => {});
      expect(timer.getRemaining()).toBe(60);
    });

    it('xử lý duration 0', () => {
      const onExpire = vi.fn();
      const timer = Timer.createTimer(0, () => {}, onExpire);
      expect(timer.getRemaining()).toBe(0);
    });

    it('xử lý duration âm', () => {
      const timer = Timer.createTimer(-5, () => {}, () => {});
      expect(timer.getRemaining()).toBe(0);
    });
  });

  describe('start()', () => {
    it('gọi onTick ngay lập tức khi start', () => {
      const onTick = vi.fn();
      const timer = Timer.createTimer(1, onTick, () => {});
      timer.start();
      expect(onTick).toHaveBeenCalledWith(60);
    });

    it('gọi onTick mỗi giây', () => {
      const onTick = vi.fn();
      const timer = Timer.createTimer(1, onTick, () => {});
      timer.start();

      vi.advanceTimersByTime(3000); // 3 giây
      // 1 lần ngay lập tức + 3 lần mỗi giây
      expect(onTick).toHaveBeenCalledTimes(4);
      expect(onTick).toHaveBeenLastCalledWith(57);
    });

    it('không start lại nếu đã running', () => {
      const onTick = vi.fn();
      const timer = Timer.createTimer(1, onTick, () => {});
      timer.start();
      timer.start(); // gọi lại
      
      vi.advanceTimersByTime(1000);
      // Chỉ 1 lần start + 1 tick, không phải 2 lần start
      expect(onTick).toHaveBeenCalledTimes(2);
    });
  });

  describe('pause()', () => {
    it('dừng đếm ngược', () => {
      const onTick = vi.fn();
      const timer = Timer.createTimer(1, onTick, () => {});
      timer.start();
      
      vi.advanceTimersByTime(2000); // 2 giây
      timer.pause();
      
      const remaining = timer.getRemaining();
      vi.advanceTimersByTime(5000); // thêm 5 giây
      
      expect(timer.getRemaining()).toBe(remaining); // không thay đổi
    });
  });

  describe('stop()', () => {
    it('dừng timer và reset remaining về 0', () => {
      const timer = Timer.createTimer(1, () => {}, () => {});
      timer.start();
      vi.advanceTimersByTime(2000);
      timer.stop();
      
      expect(timer.getRemaining()).toBe(0);
    });
  });

  describe('onExpire', () => {
    it('gọi onExpire khi hết giờ', () => {
      const onExpire = vi.fn();
      const timer = Timer.createTimer(1, () => {}, onExpire);
      timer.start();
      
      vi.advanceTimersByTime(60000); // 60 giây
      
      expect(onExpire).toHaveBeenCalledTimes(1);
    });

    it('remaining = 0 sau khi hết giờ', () => {
      const timer = Timer.createTimer(1, () => {}, () => {});
      timer.start();
      vi.advanceTimersByTime(60000);
      
      expect(timer.getRemaining()).toBe(0);
    });

    it('không gọi onTick sau khi hết giờ', () => {
      const onTick = vi.fn();
      const timer = Timer.createTimer(1, onTick, () => {});
      timer.start();
      
      vi.advanceTimersByTime(60000); // hết giờ
      const callCount = onTick.mock.calls.length;
      
      vi.advanceTimersByTime(5000); // thêm 5 giây
      expect(onTick.mock.calls.length).toBe(callCount); // không tăng
    });
  });

  describe('getRemaining()', () => {
    it('giảm dần theo thời gian', () => {
      const timer = Timer.createTimer(1, () => {}, () => {});
      timer.start();
      
      vi.advanceTimersByTime(10000); // 10 giây
      expect(timer.getRemaining()).toBe(50);
    });
  });
});
