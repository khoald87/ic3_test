/**
 * Student Name Dialog — Modal nhập tên học sinh
 * Hiển thị trước khi bắt đầu ôn tập hoặc thi thử
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ic3_student_name';

  /**
   * Hiển thị modal nhập tên
   * @param {Function} callback — gọi callback(name) khi xác nhận
   */
  function show(callback) {
    // Remove existing modal if any
    var existing = document.getElementById('studentNameOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'studentNameOverlay';
    overlay.className = 'sn-overlay';

    var modal = document.createElement('div');
    modal.className = 'sn-modal';

    modal.innerHTML =
      '<div class="sn-icon">👋</div>' +
      '<h2 class="sn-title">Xin chào!</h2>' +
      '<p class="sn-subtitle">Vui lòng nhập tên của em để bắt đầu</p>' +
      '<div class="sn-form">' +
        '<input type="text" id="snInput" class="sn-input" placeholder="Nhập tên của em..." maxlength="50" autocomplete="off" />' +
        '<div id="snError" class="sn-error" style="display:none;">Vui lòng nhập tên của em</div>' +
        '<button id="snConfirm" class="sn-confirm-btn">✅ Xác nhận</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var input = document.getElementById('snInput');
    var errorEl = document.getElementById('snError');
    var confirmBtn = document.getElementById('snConfirm');

    // Focus input
    setTimeout(function () { input.focus(); }, 100);

    function validate(name) {
      var trimmed = (name || '').trim();
      if (trimmed.length < 2 || trimmed.length > 50) return false;
      if (/^\s+$/.test(trimmed)) return false;
      return true;
    }

    function submit() {
      var name = input.value;
      if (!validate(name)) {
        errorEl.style.display = 'block';
        input.classList.add('sn-input-error');
        return;
      }
      errorEl.style.display = 'none';
      input.classList.remove('sn-input-error');

      var trimmedName = name.trim();
      sessionStorage.setItem(STORAGE_KEY, trimmedName);
      overlay.remove();
      if (typeof callback === 'function') {
        callback(trimmedName);
      }
    }

    confirmBtn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
    input.addEventListener('input', function () {
      errorEl.style.display = 'none';
      input.classList.remove('sn-input-error');
    });
  }

  /**
   * Lấy tên học sinh hiện tại từ sessionStorage
   * @returns {string|null}
   */
  function getCurrentName() {
    return sessionStorage.getItem(STORAGE_KEY);
  }

  /**
   * Xóa tên học sinh khỏi sessionStorage
   */
  function clearName() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  window.StudentNameDialog = {
    show: show,
    getCurrentName: getCurrentName,
    clearName: clearName
  };
})();
