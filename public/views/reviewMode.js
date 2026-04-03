/**
 * Review Mode View — Chế độ ôn tập
 * Hiển thị từng câu hỏi một với giải thích đáp án ngay lập tức
 */
(function () {
  'use strict';

  var currentIndex = 0;
  var questions = [];
  var moduleId = '';
  var results = []; // { questionId, isCorrect }
  var answered = false;

  /**
   * Render Review Mode
   * @param {HTMLElement} container
   * @param {string} modId
   * @param {Object[]} qs
   */
  function render(container, modId, qs) {
    container.innerHTML = '';
    window.QuestionRenderer.resetAnswers();

    if (!modId) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">⚠️</div>' +
          '<p>Vui lòng chọn một module trước khi ôn tập.</p>' +
          '<button class="btn-primary" onclick="window.Router.navigateTo(\'#/\')">Về trang chủ</button>' +
        '</div>';
      return;
    }

    if (!qs || qs.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">📭</div>' +
          '<p>Không có câu hỏi nào cho module này.</p>' +
          '<button class="btn-primary" onclick="window.Router.navigateTo(\'#/\')">Về trang chủ</button>' +
        '</div>';
      return;
    }

    moduleId = modId;
    questions = qs;
    currentIndex = 0;
    results = [];
    answered = false;

    renderQuestion(container);
  }

  /**
   * Render câu hỏi hiện tại
   */
  function renderQuestion(container) {
    container.innerHTML = '';
    answered = false;

    var q = questions[currentIndex];

    // Header
    var header = document.createElement('div');
    header.className = 'exam-header';
    header.innerHTML =
      '<div class="exam-info">📖 Ôn tập — Câu ' + (currentIndex + 1) + '/' + questions.length + '</div>' +
      '<button class="btn-secondary" id="btnBackDashboard">🏠 Về trang chủ</button>';
    container.appendChild(header);

    header.querySelector('#btnBackDashboard').addEventListener('click', function () {
      window.Router.navigateTo('#/');
    });

    // Quiz container
    var quiz = document.createElement('div');
    quiz.className = 'quiz-container';

    var questionEl = window.QuestionRenderer.renderQuestion(q, currentIndex, {
      showExplanation: false,
      disabled: false
    });
    quiz.appendChild(questionEl);

    // Check button
    var checkBtn = document.createElement('button');
    checkBtn.className = 'btn-primary';
    checkBtn.style.cssText = 'width:100%;margin-top:20px;justify-content:center;padding:16px;font-size:1.05rem;border-radius:999px;';
    checkBtn.textContent = '✅ Kiểm tra đáp án';
    checkBtn.id = 'btnCheck';
    quiz.appendChild(checkBtn);

    // Next area (hidden initially)
    var nextArea = document.createElement('div');
    nextArea.id = 'nextArea';
    nextArea.style.display = 'none';
    quiz.appendChild(nextArea);

    container.appendChild(quiz);

    checkBtn.addEventListener('click', function () {
      if (answered) return;

      var selected = window.QuestionRenderer.getAnswer(currentIndex);
      if (selected === null) {
        alert('Vui lòng chọn đáp án trước khi kiểm tra!');
        return;
      }

      answered = true;
      var isCorrect = window.QuestionRenderer.checkAnswer(currentIndex, q);

      results.push({ questionId: q.id, isCorrect: isCorrect });
      window.StorageManager.updateProgress(moduleId, q.id, isCorrect);

      // Save to server with student name
      var studentName = sessionStorage.getItem('ic3_student_name');
      if (studentName) {
        window.StorageManager.saveProgressToServer(studentName, moduleId, q.id, isCorrect);
      }

      // Show explanation
      if (q.explanation) {
        var explanationBox = document.createElement('div');
        explanationBox.className = 'explanation-box';
        explanationBox.innerHTML = '💡 <strong>Giải thích:</strong> ' + escapeHtml(q.explanation);
        questionEl.appendChild(explanationBox);
      }

      checkBtn.style.display = 'none';
      nextArea.style.display = 'block';

      if (currentIndex < questions.length - 1) {
        nextArea.innerHTML = '<button class="btn-next" id="btnNext" style="margin-top:16px;">Câu tiếp theo →</button>';
        nextArea.querySelector('#btnNext').addEventListener('click', function () {
          currentIndex++;
          renderQuestion(container);
        });
      } else {
        nextArea.innerHTML = '<button class="btn-success" id="btnSummary" style="margin-top:16px;padding:14px 32px;border-radius:999px;font-size:1rem;">📊 Xem tổng kết</button>';
        nextArea.querySelector('#btnSummary').addEventListener('click', function () {
          renderSummary(container);
        });
      }
    });
  }

  /**
   * Render trang tổng kết
   */
  function renderSummary(container) {
    container.innerHTML = '';

    var correctCount = 0;
    var wrongList = [];

    for (var i = 0; i < results.length; i++) {
      if (results[i].isCorrect) {
        correctCount++;
      } else {
        wrongList.push(results[i]);
      }
    }

    var incorrectCount = results.length - correctCount;

    var summary = document.createElement('div');
    summary.className = 'review-summary';

    summary.innerHTML =
      '<h2>📊 Tổng kết ôn tập</h2>' +
      '<div class="review-stats">' +
        '<div class="review-stat">' +
          '<div class="review-stat-number correct-num">' + correctCount + '</div>' +
          '<div class="review-stat-label">Câu đúng ✓</div>' +
        '</div>' +
        '<div class="review-stat">' +
          '<div class="review-stat-number incorrect-num">' + incorrectCount + '</div>' +
          '<div class="review-stat-label">Câu sai ✗</div>' +
        '</div>' +
        '<div class="review-stat">' +
          '<div class="review-stat-number" style="color:var(--primary)">' + results.length + '</div>' +
          '<div class="review-stat-label">Tổng câu</div>' +
        '</div>' +
      '</div>';

    if (wrongList.length > 0) {
      var wrongSection = document.createElement('div');
      wrongSection.className = 'review-wrong-list';
      wrongSection.innerHTML = '<h3>📌 Câu cần ôn lại:</h3>';

      for (var w = 0; w < wrongList.length; w++) {
        var qId = wrongList[w].questionId;
        var q = findQuestion(qId);
        if (q) {
          var item = document.createElement('div');
          item.className = 'review-wrong-item';
          item.textContent = '❌ ' + q.q;
          wrongSection.appendChild(item);
        }
      }

      summary.appendChild(wrongSection);
    }

    var actions = document.createElement('div');
    actions.style.cssText = 'margin-top:24px;display:flex;gap:12px;justify-content:center;';
    actions.innerHTML =
      '<button class="btn-primary" id="btnRetry">🔄 Ôn lại</button>' +
      '<button class="btn-secondary" id="btnHome">🏠 Về trang chủ</button>';
    summary.appendChild(actions);

    container.appendChild(summary);

    summary.querySelector('#btnRetry').addEventListener('click', function () {
      render(container, moduleId, questions);
    });
    summary.querySelector('#btnHome').addEventListener('click', function () {
      window.Router.navigateTo('#/');
    });
  }

  function findQuestion(qId) {
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].id === qId) return questions[i];
    }
    return null;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  window.ReviewModeView = { render: render };
})();
