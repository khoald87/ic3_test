/**
 * Question Renderer — Hiển thị câu hỏi theo 4 dạng
 * single-choice, true-false, multiple-choice, drag-drop
 */
(function () {
  'use strict';

  // Lưu trữ câu trả lời đã chọn
  var answers = {};

  /**
   * Render một câu hỏi dựa trên type
   * @param {Object} question
   * @param {number} index — số thứ tự (0-based)
   * @param {Object} options — { showExplanation, disabled, mode }
   * @returns {HTMLElement}
   */
  function renderQuestion(question, index, options) {
    options = options || {};
    var container = document.createElement('div');
    container.className = 'question-block';
    container.setAttribute('data-question-index', index);

    // Tiêu đề câu hỏi
    var title = document.createElement('div');
    title.className = 'question-text';
    title.textContent = 'Câu ' + (index + 1) + ': ' + question.q;
    container.appendChild(title);

    // Render theo type
    var optionsEl;
    switch (question.type) {
      case 'true-false':
        optionsEl = renderTrueFalse(question, index, options);
        break;
      case 'multiple-choice':
        optionsEl = renderMultipleChoice(question, index, options);
        break;
      case 'drag-drop':
        optionsEl = renderDragDrop(question, index, options);
        break;
      default: // single-choice
        optionsEl = renderSingleChoice(question, index, options);
        break;
    }
    container.appendChild(optionsEl);

    // Feedback container (ẩn mặc định)
    var feedback = document.createElement('div');
    feedback.className = 'question-feedback';
    feedback.id = 'feedback-' + index;
    feedback.style.display = 'none';
    container.appendChild(feedback);

    // Giải thích đáp án
    if (options.showExplanation && question.explanation) {
      var explanation = document.createElement('div');
      explanation.className = 'explanation-box';
      explanation.innerHTML = '💡 <strong>Giải thích:</strong> ' + escapeHtml(question.explanation);
      container.appendChild(explanation);
    }

    return container;
  }

  /**
   * Render single-choice — radio buttons A/B/C/D
   */
  function renderSingleChoice(question, index, options) {
    var wrapper = document.createElement('div');
    wrapper.className = 'options-wrapper';
    var labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    for (var i = 0; i < question.options.length; i++) {
      var label = document.createElement('label');
      label.className = 'option-label';
      label.id = 'label-' + index + '-' + i;

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'q' + index;
      input.value = i;
      if (options.disabled) input.disabled = true;

      (function (idx, qIdx) {
        input.addEventListener('change', function () {
          answers[qIdx] = idx;
        });
      })(i, index);

      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + (labels[i] || '') + '. ' + question.options[i]));
      wrapper.appendChild(label);
    }

    return wrapper;
  }

  /**
   * Render true-false — radio Đúng/Sai
   */
  function renderTrueFalse(question, index, options) {
    var wrapper = document.createElement('div');
    wrapper.className = 'options-wrapper';
    var tfLabels = ['Đúng', 'Sai'];

    for (var i = 0; i < question.options.length; i++) {
      var label = document.createElement('label');
      label.className = 'option-label';
      label.id = 'label-' + index + '-' + i;

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'q' + index;
      input.value = i;
      if (options.disabled) input.disabled = true;

      (function (idx, qIdx) {
        input.addEventListener('change', function () {
          answers[qIdx] = idx;
        });
      })(i, index);

      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + question.options[i]));
      wrapper.appendChild(label);
    }

    return wrapper;
  }

  /**
   * Render multiple-choice — checkboxes
   */
  function renderMultipleChoice(question, index, options) {
    var wrapper = document.createElement('div');
    wrapper.className = 'options-wrapper';
    var labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    for (var i = 0; i < question.options.length; i++) {
      var label = document.createElement('label');
      label.className = 'option-label';
      label.id = 'label-' + index + '-' + i;

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'q' + index;
      input.value = i;
      if (options.disabled) input.disabled = true;

      (function (idx, qIdx) {
        input.addEventListener('change', function () {
          // Thu thập tất cả checkbox đã chọn
          var checked = [];
          var checkboxes = wrapper.querySelectorAll('input[type="checkbox"]:checked');
          for (var c = 0; c < checkboxes.length; c++) {
            checked.push(parseInt(checkboxes[c].value));
          }
          answers[qIdx] = checked;
        });
      })(i, index);

      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + (labels[i] || '') + '. ' + question.options[i]));
      wrapper.appendChild(label);
    }

    return wrapper;
  }


  /**
   * Render drag-drop — HTML5 Drag and Drop API với fallback dropdown
   */
  function renderDragDrop(question, index, options) {
    var wrapper = document.createElement('div');
    wrapper.className = 'options-wrapper drag-drop-wrapper';

    // Kiểm tra hỗ trợ drag & drop
    var supportsDragDrop = ('draggable' in document.createElement('div'));

    if (supportsDragDrop && !options.disabled) {
      // HTML5 Drag and Drop
      var instruction = document.createElement('p');
      instruction.className = 'drag-instruction';
      instruction.textContent = '📌 Kéo thả để sắp xếp đúng thứ tự:';
      wrapper.appendChild(instruction);

      var list = document.createElement('div');
      list.className = 'drag-list';
      list.setAttribute('data-question-index', index);

      for (var i = 0; i < question.options.length; i++) {
        var item = document.createElement('div');
        item.className = 'drag-item';
        item.draggable = true;
        item.setAttribute('data-original-index', i);
        item.textContent = question.options[i];

        item.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', this.getAttribute('data-original-index'));
          this.classList.add('dragging');
        });

        item.addEventListener('dragend', function () {
          this.classList.remove('dragging');
        });

        list.appendChild(item);
      }

      list.addEventListener('dragover', function (e) {
        e.preventDefault();
        var dragging = list.querySelector('.dragging');
        var afterElement = getDragAfterElement(list, e.clientY);
        if (afterElement == null) {
          list.appendChild(dragging);
        } else {
          list.insertBefore(dragging, afterElement);
        }
      });

      list.addEventListener('drop', function (e) {
        e.preventDefault();
        // Cập nhật answer theo thứ tự hiện tại
        var items = list.querySelectorAll('.drag-item');
        var order = [];
        for (var j = 0; j < items.length; j++) {
          order.push(parseInt(items[j].getAttribute('data-original-index')));
        }
        answers[index] = order;
      });

      wrapper.appendChild(list);
    } else {
      // Fallback: dropdown cho trình duyệt cũ hoặc disabled
      var instruction2 = document.createElement('p');
      instruction2.className = 'drag-instruction';
      instruction2.textContent = '📌 Chọn thứ tự đúng cho mỗi bước:';
      wrapper.appendChild(instruction2);

      for (var k = 0; k < question.options.length; k++) {
        var row = document.createElement('div');
        row.className = 'drag-fallback-row';

        var select = document.createElement('select');
        select.className = 'drag-fallback-select';
        select.setAttribute('data-position', k);
        if (options.disabled) select.disabled = true;

        var defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Chọn bước ' + (k + 1);
        select.appendChild(defaultOpt);

        for (var m = 0; m < question.options.length; m++) {
          var opt = document.createElement('option');
          opt.value = m;
          opt.textContent = question.options[m];
          select.appendChild(opt);
        }

        (function (qIdx, totalOpts) {
          select.addEventListener('change', function () {
            // Thu thập tất cả dropdown
            var selects = wrapper.querySelectorAll('.drag-fallback-select');
            var order = [];
            for (var s = 0; s < selects.length; s++) {
              var val = selects[s].value;
              order.push(val === '' ? -1 : parseInt(val));
            }
            answers[qIdx] = order;
          });
        })(index, question.options.length);

        var labelText = document.createElement('span');
        labelText.className = 'drag-fallback-label';
        labelText.textContent = 'Vị trí ' + (k + 1) + ': ';

        row.appendChild(labelText);
        row.appendChild(select);
        wrapper.appendChild(row);
      }
    }

    return wrapper;
  }

  /**
   * Helper: tìm phần tử sau vị trí chuột (cho drag & drop)
   */
  function getDragAfterElement(container, y) {
    var elements = Array.prototype.slice.call(
      container.querySelectorAll('.drag-item:not(.dragging)')
    );
    var closest = null;
    var closestOffset = Number.NEGATIVE_INFINITY;

    elements.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = child;
      }
    });

    return closest;
  }

  /**
   * Lấy câu trả lời đã chọn cho một câu hỏi
   * @param {number} questionIndex
   * @returns {number|number[]|null}
   */
  function getAnswer(questionIndex) {
    return answers.hasOwnProperty(questionIndex) ? answers[questionIndex] : null;
  }

  /**
   * Kiểm tra đáp án và hiển thị feedback
   * @param {number} questionIndex
   * @param {Object} question
   * @returns {boolean} true nếu đúng
   */
  function checkAnswer(questionIndex, question) {
    var selected = getAnswer(questionIndex);
    var correct = question.correct;
    var isCorrect = false;

    if (selected === null) {
      isCorrect = false;
    } else if (Array.isArray(correct)) {
      // multiple-choice hoặc drag-drop
      if (Array.isArray(selected)) {
        if (selected.length === correct.length) {
          isCorrect = true;
          for (var i = 0; i < correct.length; i++) {
            if (selected[i] !== correct[i]) {
              isCorrect = false;
              break;
            }
          }
        }
      }
    } else {
      // single-choice hoặc true-false
      isCorrect = (selected === correct);
    }

    // Hiển thị feedback
    showFeedback(questionIndex, question, isCorrect, selected);

    return isCorrect;
  }

  /**
   * Hiển thị feedback đúng/sai
   */
  function showFeedback(questionIndex, question, isCorrect, selected) {
    var feedbackEl = document.getElementById('feedback-' + questionIndex);
    if (!feedbackEl) return;

    feedbackEl.style.display = 'block';

    if (isCorrect) {
      feedbackEl.className = 'question-feedback feedback-correct';
      feedbackEl.textContent = '✓ Chính xác!';
    } else {
      feedbackEl.className = 'question-feedback feedback-incorrect';
      feedbackEl.textContent = '✗ Chưa đúng!';
    }

    // Đánh dấu options đúng/sai (cho single-choice, true-false, multiple-choice)
    if (question.type !== 'drag-drop') {
      var correctIndices = Array.isArray(question.correct) ? question.correct : [question.correct];
      var selectedIndices = Array.isArray(selected) ? selected : (selected !== null ? [selected] : []);

      for (var i = 0; i < question.options.length; i++) {
        var label = document.getElementById('label-' + questionIndex + '-' + i);
        if (!label) continue;

        label.classList.remove('correct', 'incorrect');

        if (correctIndices.indexOf(i) !== -1) {
          label.classList.add('correct');
        } else if (selectedIndices.indexOf(i) !== -1) {
          label.classList.add('incorrect');
        }
      }
    }
  }

  /**
   * Reset tất cả câu trả lời
   */
  function resetAnswers() {
    answers = {};
  }

  /**
   * Escape HTML để tránh XSS
   */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  // Expose globally
  window.QuestionRenderer = {
    renderQuestion: renderQuestion,
    getAnswer: getAnswer,
    checkAnswer: checkAnswer,
    resetAnswers: resetAnswers
  };
})();
