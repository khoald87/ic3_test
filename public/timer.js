/**
 * Timer Module — Đồng hồ đếm ngược
 * Dùng cho chế độ thi thử 50 phút
 */
(function () {
  'use strict';

  /**
   * Tạo đồng hồ đếm ngược
   * @param {number} durationMinutes — thời gian (phút)
   * @param {Function} onTick — callback mỗi giây, nhận (remainingSeconds)
   * @param {Function} onExpire — callback khi hết giờ
   * @returns {{ start: Function, pause: Function, stop: Function, getRemaining: Function }}
   */
  function createTimer(durationMinutes, onTick, onExpire) {
    var totalSeconds = Math.max(0, Math.floor(durationMinutes * 60));
    var remaining = totalSeconds;
    var intervalId = null;
    var running = false;

    function tick() {
      if (remaining <= 0) {
        stop();
        if (typeof onExpire === 'function') {
          onExpire();
        }
        return;
      }
      remaining--;
      if (typeof onTick === 'function') {
        onTick(remaining);
      }
      if (remaining <= 0) {
        stop();
        if (typeof onExpire === 'function') {
          onExpire();
        }
      }
    }

    function start() {
      if (running) return;
      running = true;
      // Gọi onTick ngay lập tức với giá trị hiện tại
      if (typeof onTick === 'function') {
        onTick(remaining);
      }
      intervalId = setInterval(tick, 1000);
    }

    function pause() {
      if (!running) return;
      running = false;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function stop() {
      running = false;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      remaining = 0;
    }

    function getRemaining() {
      return remaining;
    }

    return {
      start: start,
      pause: pause,
      stop: stop,
      getRemaining: getRemaining
    };
  }

  // Expose globally
  window.Timer = {
    createTimer: createTimer
  };
})();
