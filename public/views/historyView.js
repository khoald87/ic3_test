/**
 * History View — Lịch sử & thống kê
 * Theme: Light blue bg, area chart, result cards with large icons
 */
(function () {
  'use strict';

  var DOMAIN_LABELS = {
    hardware: 'Phần cứng & Thiết bị',
    software: 'Phần mềm & Hệ điều hành',
    networking: 'Internet & Kết nối'
  };

  /**
   * Render History View
   * @param {HTMLElement} container
   * @param {string|null} examId
   */
  function render(container, examId) {
    container.innerHTML = '';

    if (examId) {
      renderExamDetail(container, examId);
    } else {
      renderHistoryList(container);
    }
  }

  /**
   * Render danh sách lịch sử bài thi
   * Ưu tiên tải từ server khi có student name, fallback localStorage
   */
  function renderHistoryList(container) {
    var studentName = sessionStorage.getItem('ic3_student_name');

    // Header
    var header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<span style="font-size:2rem;color:#FACC15;">⭐</span>' +
        '<h1 class="section-title">Hành trình học tập</h1>' +
      '</div>' +
      '<button class="btn-secondary" id="btnBackHome">' +
        '🏠 Về trang chủ</button>';
    container.appendChild(header);

    header.querySelector('#btnBackHome').addEventListener('click', function () {
      window.Router.navigateTo('#/');
    });

    if (!studentName) {
      container.innerHTML +=
        '<div class="empty-state">' +
          '<div class="empty-state-icon">👤</div>' +
          '<p>Vui lòng nhập tên để xem lịch sử học tập</p>' +
          '<button class="btn-primary" onclick="window.Router.navigateTo(\'#/exam\')">📝 Bắt đầu thi thử</button>' +
        '</div>';
      return;
    }

    // Show loading while fetching from server
    var contentArea = document.createElement('div');
    contentArea.className = 'history-content-area';
    contentArea.innerHTML =
      '<div style="text-align:center;padding:40px 0;color:#64748B;">' +
        '<div style="font-size:2rem;margin-bottom:12px;">⏳</div>' +
        '<p>Đang tải lịch sử từ server...</p>' +
      '</div>';
    container.appendChild(contentArea);

    // Try server first, fallback to localStorage
    window.StorageManager.getExamHistoryFromServer(studentName)
      .then(function (serverHistory) {
        if (serverHistory && serverHistory.length > 0) {
          // Server returned data — use it
          displayHistoryData(contentArea, serverHistory, false);
        } else if (serverHistory && serverHistory.length === 0) {
          // Server returned empty array — no exams yet
          displayHistoryData(contentArea, [], false);
        } else {
          // Server returned null (error/offline) — fallback to localStorage
          var localHistory = window.StorageManager.getExamHistory();
          displayHistoryData(contentArea, localHistory, true);
        }
      });
  }

  /**
   * Hiển thị dữ liệu lịch sử thi (từ server hoặc localStorage)
   * @param {HTMLElement} contentArea - container để render vào
   * @param {Object[]} history - danh sách bài thi
   * @param {boolean} isOffline - true nếu đang dùng dữ liệu localStorage fallback
   */
  function displayHistoryData(contentArea, history, isOffline) {
    contentArea.innerHTML = '';

    // Offline banner
    if (isOffline) {
      var banner = document.createElement('div');
      banner.className = 'offline-banner';
      banner.setAttribute('role', 'alert');
      banner.innerHTML =
        '<span style="margin-right:8px;">📡</span>' +
        'Đang hiển thị dữ liệu offline';
      banner.style.cssText =
        'background:#FEF3C7;color:#92400E;padding:10px 16px;border-radius:8px;' +
        'margin-bottom:16px;font-size:0.9rem;display:flex;align-items:center;';
      contentArea.appendChild(banner);
    }

    if (!history || history.length === 0) {
      contentArea.innerHTML +=
        '<div class="empty-state">' +
          '<div class="empty-state-icon">📭</div>' +
          '<p>Chưa có bài thi nào. Hãy thử thi thử nhé!</p>' +
          '<button class="btn-primary" onclick="window.Router.navigateTo(\'#/exam\')">📝 Thi thử ngay</button>' +
        '</div>';
      return;
    }

    // Score chart
    if (history.length >= 2) {
      renderScoreChart(contentArea, history);
    }

    // Results heading
    var resultsHeading = document.createElement('h3');
    resultsHeading.style.cssText = 'font-size:1.5rem;font-weight:700;color:#1E293B;margin-bottom:24px;';
    resultsHeading.textContent = 'Kết quả bài thi gần đây';
    contentArea.appendChild(resultsHeading);

    // History list — card grid
    var list = document.createElement('div');
    list.className = 'history-list';

    for (var i = 0; i < history.length; i++) {
      var exam = history[i];
      var statusClass = exam.passed ? 'passed' : 'failed';
      var statusText = exam.passed ? '✓ Đã đạt' : '⚠ Cố gắng hơn';
      var dateStr = formatDate(exam.date);

      var item = document.createElement('div');
      item.className = 'history-item';

      // Large icon area
      var iconArea = document.createElement('div');
      iconArea.className = 'history-icon-area ' + statusClass;
      iconArea.innerHTML = exam.passed ? '🏆' : '🤖';
      item.appendChild(iconArea);

      // Info area
      var info = document.createElement('div');
      info.className = 'history-item-info';
      info.innerHTML =
        '<div class="history-item-date">' + dateStr + '</div>' +
        '<div class="history-item-title">Bài thi IC3 Spark</div>' +
        '<div style="display:flex;align-items:center;gap:12px;margin-top:4px;">' +
          '<span class="history-item-status ' + statusClass + '">' + statusText + '</span>' +
          '<span class="history-item-score">' + exam.correctCount + '/' + exam.totalQuestions + ' câu đúng</span>' +
        '</div>';
      item.appendChild(info);

      (function (examId) {
        item.addEventListener('click', function () {
          window.Router.navigateTo('#/history/' + examId);
        });
      })(exam.examId);

      list.appendChild(item);
    }

    contentArea.appendChild(list);
  }

  /**
   * Render biểu đồ xu hướng điểm số
   */
  function renderScoreChart(container, history) {
    var chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.innerHTML = '<h3>📈 Xu hướng điểm số của em</h3>';

    var canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 300;
    canvas.style.cssText = 'width:100%;max-height:300px;';
    chartContainer.appendChild(canvas);
    container.appendChild(chartContainer);

    setTimeout(function () { drawChart(canvas, history); }, 50);
  }

  /**
   * Vẽ biểu đồ đường với area gradient
   */
  function drawChart(canvas, history) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    var w = rect.width;
    var h = rect.height;
    var padding = { top: 20, right: 30, bottom: 40, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    var data = history.slice().reverse();
    var maxItems = Math.min(data.length, 20);
    data = data.slice(data.length - maxItems);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    var gridLines = [0, 250, 500, 700, 1000];
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'right';

    for (var g = 0; g < gridLines.length; g++) {
      var y = padding.top + chartH - (gridLines[g] / 1000) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(gridLines[g], padding.left - 8, y + 4);
    }

    // Pass threshold line
    var passY = padding.top + chartH - (700 / 1000) * chartH;
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, passY);
    ctx.lineTo(w - padding.right, passY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#22C55E';
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('Mục tiêu', w - padding.right + 4, passY + 4);

    if (data.length < 2) return;

    var stepX = chartW / (data.length - 1);
    var points = [];
    for (var i = 0; i < data.length; i++) {
      var x = padding.left + i * stepX;
      var y = padding.top + chartH - (data[i].score / 1000) * chartH;
      points.push({ x: x, y: y, score: data[i].score, passed: data[i].passed });
    }

    // Area gradient fill
    var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(14, 165, 233, 0.3)');
    gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    for (var p = 0; p < points.length; p++) {
      ctx.lineTo(points[p].x, points[p].y);
    }
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.strokeStyle = '#0EA5E9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (var p = 0; p < points.length; p++) {
      if (p === 0) ctx.moveTo(points[p].x, points[p].y);
      else ctx.lineTo(points[p].x, points[p].y);
    }
    ctx.stroke();

    // Dots
    for (var p = 0; p < points.length; p++) {
      ctx.beginPath();
      ctx.arc(points[p].x, points[p].y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#0EA5E9';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // X-axis labels
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.font = '11px Inter, sans-serif';
    for (var l = 0; l < points.length; l++) {
      ctx.fillText('Lần ' + (l + 1), points[l].x, h - padding.bottom + 20);
    }
  }

  /**
   * Render chi tiết một bài thi
   */
  function renderExamDetail(container, examId) {
    var history = window.StorageManager.getExamHistory();
    var exam = null;

    for (var i = 0; i < history.length; i++) {
      if (history[i].examId === examId) {
        exam = history[i];
        break;
      }
    }

    if (!exam) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🔍</div>' +
          '<p>Không tìm thấy bài thi này.</p>' +
          '<button class="btn-primary" onclick="window.Router.navigateTo(\'#/history\')">Quay lại lịch sử</button>' +
        '</div>';
      return;
    }

    // Header
    var header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML =
      '<h1 class="section-title">📋 Chi tiết bài thi</h1>' +
      '<button class="btn-secondary" id="btnBackHistory">⬅️ Quay lại</button>';
    container.appendChild(header);

    header.querySelector('#btnBackHistory').addEventListener('click', function () {
      window.Router.navigateTo('#/history');
    });

    // Result card
    var statusClass = exam.passed ? 'passed' : 'failed';
    var statusText = exam.passed ? '🎉 ĐẠT' : '😔 CHƯA ĐẠT';
    var minutes = Math.floor((exam.timeSpent || 0) / 60);
    var seconds = (exam.timeSpent || 0) % 60;

    var card = document.createElement('div');
    card.className = 'result-card ' + statusClass;
    card.innerHTML =
      '<div class="result-score">' + exam.score + '/1000</div>' +
      '<div class="result-status">' + statusText + '</div>' +
      '<div style="font-size:0.9rem;font-weight:400;">' +
        '📅 ' + formatDate(exam.date) + ' &nbsp;|&nbsp; ' +
        '✅ ' + exam.correctCount + '/' + exam.totalQuestions + ' câu đúng &nbsp;|&nbsp; ' +
        '⏱️ ' + minutes + ' phút ' + seconds + ' giây' +
      '</div>';
    container.appendChild(card);

    // Domain scores
    if (exam.domainScores) {
      var domainSection = document.createElement('div');
      domainSection.className = 'domain-scores';
      domainSection.innerHTML = '<h3 style="margin-bottom:12px;">📊 Điểm theo lĩnh vực</h3>';

      var domains = ['hardware', 'software', 'networking'];
      for (var d = 0; d < domains.length; d++) {
        var key = domains[d];
        var ds = exam.domainScores[key] || { correct: 0, total: 0 };
        var pct = ds.total > 0 ? Math.round((ds.correct / ds.total) * 100) : 0;

        var row = document.createElement('div');
        row.className = 'domain-score-row';
        row.innerHTML =
          '<span class="domain-score-label">' + (DOMAIN_LABELS[key] || key) + '</span>' +
          '<div class="domain-score-bar"><div class="domain-score-fill ' + key + '" style="width:' + pct + '%"></div></div>' +
          '<span class="domain-score-value">' + ds.correct + '/' + ds.total + '</span>';
        domainSection.appendChild(row);
      }
      container.appendChild(domainSection);
    }

    // Answer details
    if (exam.answers && exam.answers.length > 0) {
      var details = document.createElement('div');
      details.style.cssText = 'margin-top:24px;';
      details.innerHTML = '<h3 style="margin-bottom:12px;font-weight:700;">📝 Chi tiết từng câu</h3>';

      for (var a = 0; a < exam.answers.length; a++) {
        var ans = exam.answers[a];
        var icon = ans.isCorrect ? '✅' : '❌';

        var item = document.createElement('div');
        item.className = 'question-block';
        item.style.borderLeft = '4px solid ' + (ans.isCorrect ? 'var(--green)' : 'var(--red)');

        var html = '<div class="question-text">' + icon + ' Câu ' + (a + 1) + ' — ' + ans.questionId + '</div>';
        html += '<div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">';
        html += 'Đã chọn: ' + formatAnswer(ans.selectedAnswer) + ' &nbsp;|&nbsp; ';
        html += 'Đáp án đúng: ' + formatAnswer(ans.correctAnswer);
        html += '</div>';

        item.innerHTML = html;
        details.appendChild(item);
      }

      container.appendChild(details);
    }
  }

  function formatAnswer(answer) {
    if (answer === null || answer === undefined) return 'Chưa trả lời';
    if (Array.isArray(answer)) return answer.map(function (a) { return String.fromCharCode(65 + a); }).join(', ');
    return String.fromCharCode(65 + answer);
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Không rõ';
    try {
      var d = new Date(dateStr);
      var day = pad(d.getDate());
      var month = pad(d.getMonth() + 1);
      var year = d.getFullYear();
      var hours = pad(d.getHours());
      var mins = pad(d.getMinutes());
      return day + '/' + month + '/' + year + ' ' + hours + ':' + mins;
    } catch (e) {
      return dateStr;
    }
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  window.HistoryView = { render: render };
})();
