/**
 * Dashboard View — Bảng điều khiển
 * Hiển thị tổng quan 6 Module IC3 với thẻ, tiến trình, điểm cao nhất
 */
(function () {
  'use strict';

  /**
   * Render Dashboard vào container
   * @param {HTMLElement} container
   * @param {Object} data — { modules: [], questions: [] } từ API
   */
  function render(container, data) {
    container.innerHTML = '';

    if (!data || !data.modules || !data.questions) {
      container.innerHTML = '<div class="loading">Đang tải dữ liệu...</div>';
      return;
    }

    // Section header
    var header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = '<div style="display:flex;align-items:center;gap:12px;">' +
      '<span style="font-size:2rem;">🎮</span>' +
      '<h1 class="section-title">Student Learning Dashboard</h1>' +
      '</div>' +
      '<a href="#/history" class="btn-secondary" style="text-decoration:none;">' +
      '🏆 Lịch sử thi</a>';
    container.appendChild(header);

    // Grid
    var grid = document.createElement('div');
    grid.className = 'dashboard-grid';

    // Đếm câu hỏi theo module
    var questionCounts = {};
    for (var i = 0; i < data.questions.length; i++) {
      var mod = data.questions[i].module;
      questionCounts[mod] = (questionCounts[mod] || 0) + 1;
    }

    for (var m = 0; m < data.modules.length; m++) {
      var mod = data.modules[m];
      var count = questionCounts[mod.id] || 0;
      var progress = window.StorageManager.getModuleProgress(mod.id);
      var percent = window.StorageManager.getProgressPercent(mod.id, count);
      var highScore = progress.highestScore || 0;

      var card = document.createElement('div');
      card.className = 'dashboard-card';

      card.innerHTML =
        '<div class="card-header">' +
          '<div class="card-icon-area">' +
            '<span class="card-icon">' + (mod.icon || '📘') + '</span>' +
          '</div>' +
          '<div class="card-info">' +
            '<div class="card-title">Module ' + (m + 1) + ': ' + escapeHtml(mod.title) + '</div>' +
            '<div class="card-stats">' + count + ' câu hỏi | Điểm cao: ' + highScore + '%</div>' +
          '</div>' +
        '</div>' +
        '<div class="progress-bar-container">' +
          '<div class="progress-bar-fill" style="width:' + percent + '%"></div>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn-card btn-card-review" data-module="' + mod.id + '">Ôn tập</button>' +
          '<button class="btn-card btn-card-exam">Thi thử 🥳</button>' +
        '</div>';

      // Gắn sự kiện
      (function (moduleId) {
        var reviewBtn = card.querySelector('.btn-card-review');
        var examBtn = card.querySelector('.btn-card-exam');

        reviewBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          window.Router.navigateTo('#/review/' + moduleId);
        });

        examBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          window.Router.navigateTo('#/exam');
        });

        card.addEventListener('click', function () {
          window.Router.navigateTo('#/review/' + moduleId);
        });
      })(mod.id);

      grid.appendChild(card);
    }

    container.appendChild(grid);
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  window.DashboardView = { render: render };
})();
