/**
 * Exam Mode View — Chế độ thi thử
 * Mô phỏng đề thi IC3 thật: 45 câu, 50 phút
 * Theme: Purple header, round navigator, large option cards
 */
(function () {
  'use strict';

  var DOMAIN_LABELS = {
    hardware: 'Phần cứng & Thiết bị',
    software: 'Phần mềm & Hệ điều hành',
    networking: 'Internet & Kết nối'
  };

  var exam = null;
  var timer = null;
  var currentIndex = 0;
  var flagged = {};
  var submitted = false;
  var startTime = 0;
  var containerRef = null;

  /**
   * Render Exam Mode
   * @param {HTMLElement} container
   */
  function render(container) {
    containerRef = container;
    container.innerHTML = '<div class="loading">Đang tạo đề thi...</div>';

    // Reset state
    exam = null;
    timer = null;
    currentIndex = 0;
    flagged = {};
    submitted = false;
    startTime = 0;
    window.QuestionRenderer.resetAnswers();
    hideTimer();

    // Enter exam mode (hide sidebar, show purple bar)
    enterExamMode();

    // Gọi API tạo đề thi
    fetch('/api/exam/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.questions || data.questions.length === 0) {
          exitExamMode();
          container.innerHTML =
            '<div class="empty-state">' +
              '<div class="empty-state-icon">⚠️</div>' +
              '<p>Không thể tạo đề thi. Ngân hàng câu hỏi chưa đủ.</p>' +
              '<button class="btn-primary" onclick="window.Router.navigateTo(\'#/\')">Về trang chủ</button>' +
            '</div>';
          return;
        }
        exam = data;
        startExam(container);
      })
      .catch(function () {
        exitExamMode();
        container.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-state-icon">❌</div>' +
            '<p>Không thể kết nối máy chủ. Vui lòng thử lại.</p>' +
            '<button class="btn-primary" onclick="window.Router.navigateTo(\'#/\')">Về trang chủ</button>' +
          '</div>';
      });
  }

  /**
   * Enter exam mode — hide sidebar, show purple header
   */
  function enterExamMode() {
    document.body.classList.add('exam-mode');
  }

  /**
   * Exit exam mode — restore sidebar
   */
  function exitExamMode() {
    document.body.classList.remove('exam-mode');
    hideTimer();
  }

  /**
   * Bắt đầu bài thi
   */
  function startExam(container) {
    startTime = Date.now();
    submitted = false;

    timer = window.Timer.createTimer(50, function (remaining) {
      updateTimerDisplay(remaining);
    }, function () {
      if (!submitted) submitExam(container);
    });

    showTimer();
    timer.start();
    renderExamQuestion(container);
  }

  /**
   * Render câu hỏi hiện tại trong bài thi
   */
  function renderExamQuestion(container) {
    container.innerHTML = '';

    var q = exam.questions[currentIndex];
    var total = exam.questions.length;

    // Question Navigator — round circles
    var nav = document.createElement('div');
    nav.className = 'question-navigator';
    nav.id = 'questionNav';

    for (var i = 0; i < total; i++) {
      var btn = document.createElement('button');
      btn.className = 'qnav-btn';
      btn.textContent = (i + 1);

      if (i === currentIndex) btn.classList.add('current');
      if (window.QuestionRenderer.getAnswer(i) !== null) btn.classList.add('answered');
      if (flagged[i]) btn.classList.add('flagged');

      (function (idx) {
        btn.addEventListener('click', function () {
          currentIndex = idx;
          renderExamQuestion(container);
        });
      })(i);

      nav.appendChild(btn);
    }

    // Legend
    var legend = document.createElement('div');
    legend.className = 'qnav-legend';
    legend.innerHTML =
      '<span class="qnav-legend-item"><span class="qnav-legend-dot" style="background:var(--primary);border-color:var(--primary);"></span> Đang xem</span>' +
      '<span class="qnav-legend-item"><span class="qnav-legend-dot" style="background:var(--green);border-color:var(--green);"></span> Đã trả lời</span>' +
      '<span class="qnav-legend-item"><span class="qnav-legend-dot" style="background:var(--yellow);border-color:var(--yellow);"></span> Đánh dấu</span>';
    nav.appendChild(legend);

    container.appendChild(nav);

    // Exam header
    var header = document.createElement('div');
    header.className = 'exam-header';
    header.innerHTML =
      '<div class="exam-info">Câu ' + (currentIndex + 1) + '/' + total + '</div>';

    var flagBtn = document.createElement('button');
    flagBtn.className = 'btn-flag' + (flagged[currentIndex] ? ' flagged' : '');
    flagBtn.textContent = flagged[currentIndex] ? '⭐ Bỏ đánh dấu' : '⭐ Đánh dấu xem lại';
    flagBtn.addEventListener('click', function () {
      flagged[currentIndex] = !flagged[currentIndex];
      renderExamQuestion(container);
    });
    header.appendChild(flagBtn);
    container.appendChild(header);

    // Quiz container
    var quiz = document.createElement('div');
    quiz.className = 'quiz-container';

    var questionEl = window.QuestionRenderer.renderQuestion(q, currentIndex, {
      showExplanation: false,
      disabled: false
    });
    quiz.appendChild(questionEl);

    // Navigation buttons
    var navBtns = document.createElement('div');
    navBtns.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:24px;';

    if (currentIndex > 0) {
      var prevBtn = document.createElement('button');
      prevBtn.className = 'btn-secondary';
      prevBtn.textContent = '⬅️ Câu trước';
      prevBtn.addEventListener('click', function () {
        currentIndex--;
        renderExamQuestion(container);
      });
      navBtns.appendChild(prevBtn);
    } else {
      navBtns.appendChild(document.createElement('div'));
    }

    if (currentIndex < total - 1) {
      var nextBtn = document.createElement('button');
      nextBtn.className = 'btn-next';
      nextBtn.innerHTML = 'Câu tiếp <span style="margin-left:4px;">→</span>';
      nextBtn.addEventListener('click', function () {
        currentIndex++;
        renderExamQuestion(container);
      });
      navBtns.appendChild(nextBtn);
    } else {
      navBtns.appendChild(document.createElement('div'));
    }

    quiz.appendChild(navBtns);
    container.appendChild(quiz);

    // Submit button
    var submitArea = document.createElement('div');
    submitArea.style.cssText = 'margin-top:48px;text-align:center;';
    var submitBtn = document.createElement('button');
    submitBtn.className = 'btn-submit';
    submitBtn.textContent = '📤 Nộp bài';
    submitBtn.addEventListener('click', function () {
      var unanswered = countUnanswered();
      if (unanswered > 0) {
        if (!confirm('Bạn còn ' + unanswered + ' câu chưa trả lời. Bạn có chắc muốn nộp bài?')) return;
      }
      submitExam(container);
    });
    submitArea.appendChild(submitBtn);
    container.appendChild(submitArea);
  }

  /**
   * Nộp bài thi
   */
  function submitExam(container) {
    if (submitted) return;
    submitted = true;

    if (timer) timer.stop();
    exitExamMode();

    var timeSpent = Math.round((Date.now() - startTime) / 1000);
    var total = exam.questions.length;
    var correctCount = 0;
    var answers = [];

    var domainScores = {
      hardware: { correct: 0, total: 0 },
      software: { correct: 0, total: 0 },
      networking: { correct: 0, total: 0 }
    };

    for (var i = 0; i < total; i++) {
      var q = exam.questions[i];
      var selected = window.QuestionRenderer.getAnswer(i);
      var isCorrect = checkCorrect(selected, q.correct);

      if (isCorrect) correctCount++;

      var domain = q.domain;
      if (domainScores[domain]) {
        domainScores[domain].total++;
        if (isCorrect) domainScores[domain].correct++;
      }

      answers.push({
        questionId: q.id,
        selectedAnswer: selected,
        correctAnswer: q.correct,
        isCorrect: isCorrect
      });
    }

    var score = Math.round((correctCount / total) * 1000);
    var passed = score >= 700;

    var result = {
      examId: exam.id || ('exam_' + Date.now()),
      date: new Date().toISOString(),
      score: score,
      passed: passed,
      totalQuestions: total,
      correctCount: correctCount,
      timeSpent: timeSpent,
      domainScores: domainScores,
      answers: answers
    };

    window.StorageManager.saveExamResult(result);

    // Save to server with student name
    var studentName = sessionStorage.getItem('ic3_student_name');
    if (studentName) {
      window.StorageManager.saveExamResultToServer(studentName, result);
    }

    renderResult(container, result);
  }

  function checkCorrect(selected, correct) {
    if (selected === null || selected === undefined) return false;
    if (Array.isArray(correct)) {
      if (!Array.isArray(selected)) return false;
      if (selected.length !== correct.length) return false;
      for (var i = 0; i < correct.length; i++) {
        if (selected[i] !== correct[i]) return false;
      }
      return true;
    }
    return selected === correct;
  }

  /**
   * Render kết quả chi tiết
   */
  function renderResult(container, result) {
    container.innerHTML = '';

    var statusClass = result.passed ? 'passed' : 'failed';
    var statusText = result.passed ? '🎉 ĐẠT' : '😔 CHƯA ĐẠT';
    var minutes = Math.floor(result.timeSpent / 60);
    var seconds = result.timeSpent % 60;

    var card = document.createElement('div');
    card.className = 'result-card ' + statusClass;
    card.innerHTML =
      '<div class="result-score">' + result.score + '/1000</div>' +
      '<div class="result-status">' + statusText + '</div>' +
      '<div style="font-size:0.95rem;font-weight:400;">Đúng ' + result.correctCount + '/' + result.totalQuestions +
      ' câu &nbsp;|&nbsp; Thời gian: ' + minutes + ' phút ' + seconds + ' giây</div>';
    container.appendChild(card);

    // Domain scores
    var domainSection = document.createElement('div');
    domainSection.className = 'domain-scores';
    domainSection.innerHTML = '<h3 style="margin-bottom:12px;">📊 Điểm theo lĩnh vực</h3>';

    var domains = ['hardware', 'software', 'networking'];
    for (var d = 0; d < domains.length; d++) {
      var key = domains[d];
      var ds = result.domainScores[key] || { correct: 0, total: 0 };
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

    renderAnswerDetails(container, result);

    // Action buttons
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:32px;';
    actions.innerHTML =
      '<button class="btn-primary" id="btnRetryExam">🔄 Thi lại</button>' +
      '<button class="btn-secondary" id="btnHomeExam">🏠 Về trang chủ</button>' +
      '<a href="#/history" class="btn-success" style="text-decoration:none;display:inline-flex;align-items:center;padding:12px 24px;">📊 Lịch sử</a>';
    container.appendChild(actions);

    actions.querySelector('#btnRetryExam').addEventListener('click', function () {
      render(container);
    });
    actions.querySelector('#btnHomeExam').addEventListener('click', function () {
      window.Router.navigateTo('#/');
    });
  }

  /**
   * Render chi tiết từng câu trả lời
   */
  function renderAnswerDetails(container, result) {
    var details = document.createElement('div');
    details.style.cssText = 'margin-top:24px;';
    details.innerHTML = '<h3 style="margin-bottom:12px;font-weight:700;">📝 Chi tiết từng câu</h3>';

    for (var i = 0; i < result.answers.length; i++) {
      var ans = result.answers[i];
      var q = exam.questions[i];
      if (!q) continue;

      var item = document.createElement('div');
      item.className = 'question-block';
      item.style.borderLeft = '4px solid ' + (ans.isCorrect ? 'var(--green)' : 'var(--red)');

      var icon = ans.isCorrect ? '✅' : '❌';
      item.innerHTML =
        '<div class="question-text">' + icon + ' Câu ' + (i + 1) + ': ' + escapeHtml(q.q) + '</div>';

      if (!ans.isCorrect && q.explanation) {
        item.innerHTML += '<div class="explanation-box">💡 ' + escapeHtml(q.explanation) + '</div>';
      }

      details.appendChild(item);
    }

    container.appendChild(details);
  }

  function countUnanswered() {
    var count = 0;
    for (var i = 0; i < exam.questions.length; i++) {
      if (window.QuestionRenderer.getAnswer(i) === null) count++;
    }
    return count;
  }

  function showTimer() {
    var el = document.getElementById('timerDisplay');
    if (el) el.style.display = 'flex';
  }

  function hideTimer() {
    var el = document.getElementById('timerDisplay');
    if (el) el.style.display = 'none';
  }

  function updateTimerDisplay(remaining) {
    var el = document.getElementById('timerText');
    var display = document.getElementById('timerDisplay');
    if (!el) return;

    var min = Math.floor(remaining / 60);
    var sec = remaining % 60;
    el.textContent = pad(min) + ':' + pad(sec);

    if (display) {
      if (remaining <= 300) {
        display.classList.add('warning');
      } else {
        display.classList.remove('warning');
      }
    }
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  window.ExamModeView = { render: render };
})();
