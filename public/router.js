/**
 * Router Module — Hash-based SPA routing
 * Quản lý điều hướng giữa các trang trong SPA
 */
(function () {
  'use strict';

  var listeners = [];

  /**
   * Định nghĩa các route pattern
   */
  var ROUTE_PATTERNS = [
    { pattern: /^#\/admin\/([^/]+)$/, name: 'adminDetail', params: ['studentName'] },
    { pattern: /^#\/admin$/, name: 'admin', params: [] },
    { pattern: /^#\/history\/([^/]+)$/, name: 'historyDetail', params: ['examId'] },
    { pattern: /^#\/review\/([^/]+)$/, name: 'review', params: ['moduleId'] },
    { pattern: /^#\/exam$/, name: 'exam', params: [] },
    { pattern: /^#\/history$/, name: 'history', params: [] },
    { pattern: /^#\/$/, name: 'dashboard', params: [] }
  ];

  /**
   * Parse hash hiện tại thành route object
   * @returns {{ name: string, params: Object }}
   */
  function parseHash(hash) {
    if (!hash || hash === '' || hash === '#') {
      return { name: 'dashboard', params: {} };
    }

    for (var i = 0; i < ROUTE_PATTERNS.length; i++) {
      var route = ROUTE_PATTERNS[i];
      var match = hash.match(route.pattern);
      if (match) {
        var params = {};
        for (var j = 0; j < route.params.length; j++) {
          params[route.params[j]] = decodeURIComponent(match[j + 1]);
        }
        return { name: route.name, params: params };
      }
    }

    // Fallback: dashboard
    return { name: 'dashboard', params: {} };
  }

  /**
   * Lấy route hiện tại
   * @returns {{ name: string, params: Object }}
   */
  function getCurrentRoute() {
    return parseHash(window.location.hash);
  }

  /**
   * Điều hướng đến route mới
   * @param {string} route — hash path, vd: '#/review/module_1'
   */
  function navigateTo(route) {
    window.location.hash = route;
  }

  /**
   * Đăng ký callback khi route thay đổi
   * @param {Function} callback — nhận (route) object
   * @returns {Function} unsubscribe function
   */
  function onRouteChange(callback) {
    if (typeof callback !== 'function') return function () {};
    listeners.push(callback);
    return function () {
      listeners = listeners.filter(function (fn) { return fn !== callback; });
    };
  }

  /**
   * Thông báo tất cả listeners
   */
  function notifyListeners() {
    var route = getCurrentRoute();
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](route);
      } catch (e) {
        console.error('Router listener error:', e);
      }
    }
  }

  // Lắng nghe hashchange
  window.addEventListener('hashchange', notifyListeners);

  // Expose globally
  window.Router = {
    navigateTo: navigateTo,
    getCurrentRoute: getCurrentRoute,
    onRouteChange: onRouteChange
  };
})();
