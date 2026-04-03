/**
 * Admin View — Bảng quản trị giáo viên
 * Route: #/admin
 */
(function () {
  'use strict';

  var AUTH_KEY = 'ic3_admin_auth';
  var currentTab = 'students';

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  }

  function setAuthenticated(val) {
    if (val) {
      sessionStorage.setItem(AUTH_KEY, 'true');
    } else {
      sessionStorage.removeItem(AUTH_KEY);
    }
  }

  /**
   * Render admin panel
   * @param {HTMLElement} container
   */
  function render(container) {
    container.innerHTML = '';
    if (!isAuthenticated()) {
      renderPinForm(container);
    } else {
      renderAdminPanel(container);
    }
  }

  function renderPinForm(container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'admin-pin-wrapper';
    wrapper.innerHTML =
      '<div class="admin-pin-card">' +
        '<div class="admin-pin-icon">🔐</div>' +
        '<h2 class="admin-pin-title">Bảng quản trị</h2>' +
        '<p class="admin-pin-subtitle">Nhập mã PIN để truy cập</p>' +
        '<div class="admin-pin-form">' +
          '<input type="password" id="adminPinInput" class="sn-input" placeholder="Nhập mã PIN..." maxlength="6" autocomplete="off" />' +
          '<div id="adminPinError" class="sn-error" style="display:none;">Mã PIN không đúng</div>' +
          '<button id="adminPinBtn" class="sn-confirm-btn">🔓 Xác nhận</button>' +
        '</div>' +
      '</div>';
    container.appendChild(wrapper);

    var input = document.getElementById('adminPinInput');
    var errorEl = document.getElementById('adminPinError');
    var btn = document.getElementById('adminPinBtn');

    setTimeout(function () { input.focus(); }, 100);

    function submit() {
      var pin = input.value;
      errorEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = '⏳ Đang xác thực...';

      fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin })
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        btn.disabled = false;
        btn.textContent = '🔓 Xác nhận';
        if (data.success) {
          setAuthenticated(true);
          render(container);
        } else {
          errorEl.textContent = 'Mã PIN không đúng';
          errorEl.style.display = 'block';
          input.value = '';
          input.focus();
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = '🔓 Xác nhận';
        errorEl.textContent = 'Không thể kết nối máy chủ';
        errorEl.style.display = 'block';
      });
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
  }

  function renderAdminPanel(container) {
    container.innerHTML = '';

    // Header
    var header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<span style="font-size:2rem;">🛡️</span>' +
        '<h1 class="section-title">Bảng quản trị</h1>' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<button class="btn-secondary" id="adminLogout">🚪 Đăng xuất</button>' +
        '<button class="btn-secondary" id="adminHome">🏠 Về trang chủ</button>' +
      '</div>';
    container.appendChild(header);

    header.querySelector('#adminLogout').addEventListener('click', function () {
      setAuthenticated(false);
      render(container);
    });
    header.querySelector('#adminHome').addEventListener('click', function () {
      window.Router.navigateTo('#/');
    });

    // Tabs
    var tabs = document.createElement('div');
    tabs.className = 'admin-tabs';
    tabs.innerHTML =
      '<button class="admin-tab' + (currentTab === 'students' ? ' active' : '') + '" data-tab="students">👥 Danh sách học sinh</button>' +
      '<button class="admin-tab' + (currentTab === 'settings' ? ' active' : '') + '" data-tab="settings">⚙️ Cài đặt</button>';
    container.appendChild(tabs);

    var contentArea = document.createElement('div');
    contentArea.id = 'adminContent';
    container.appendChild(contentArea);

    var tabBtns = tabs.querySelectorAll('.admin-tab');
    for (var i = 0; i < tabBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          currentTab = btn.getAttribute('data-tab');
          for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove('active');
          btn.classList.add('active');
          renderTabContent(contentArea);
        });
      })(tabBtns[i]);
    }

    renderTabContent(contentArea);
  }

  function renderTabContent(contentArea) {
    if (currentTab === 'students') {
      renderStudentList(contentArea);
    } else if (currentTab === 'settings') {
      renderSettings(contentArea);
    }
  }

  function renderStudentList(contentArea) {
    contentArea.innerHTML = '<div class="loading">Đang tải danh sách...</div>';

    fetch('/api/students')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        contentArea.innerHTML = '';
        var students = data.students || [];

        // Delete all button
        var toolbar = document.createElement('div');
        toolbar.className = 'admin-toolbar';
        toolbar.innerHTML =
          '<span class="admin-count">Tổng: ' + students.length + ' học sinh</span>' +
          '<button class="admin-btn-danger" id="deleteAllBtn">🗑️ Xóa tất cả</button>';
        contentArea.appendChild(toolbar);

        toolbar.querySelector('#deleteAllBtn').addEventListener('click', function () {
          if (students.length === 0) return;
          if (!confirm('⚠️ Bạn có chắc muốn xóa TẤT CẢ dữ liệu học sinh? Hành động này không thể hoàn tác!')) return;
          var pin = prompt('Nhập mã PIN để xác nhận:');
          if (!pin) return;

          fetch('/api/students', {
            method: 'DELETE',
            headers: { 'x-admin-pin': pin }
          })
          .then(function (res) { return res.json(); })
          .then(function (result) {
            if (result.success) {
              alert('Đã xóa ' + result.deleted + ' học sinh');
              renderStudentList(contentArea);
            } else {
              alert(result.error || 'Lỗi xóa dữ liệu');
            }
          })
          .catch(function () { alert('Không thể kết nối máy chủ'); });
        });

        if (students.length === 0) {
          contentArea.innerHTML +=
            '<div class="empty-state">' +
              '<div class="empty-state-icon">📭</div>' +
              '<p>Chưa có học sinh nào trong hệ thống</p>' +
            '</div>';
          return;
        }

        // Table
        var table = document.createElement('div');
        table.className = 'admin-table-wrapper';
        var html = '<table class="admin-table">' +
          '<thead><tr>' +
            '<th>Tên học sinh</th>' +
            '<th>Số bài thi</th>' +
            '<th>Điểm TB</th>' +
            '<th>Lần thi gần nhất</th>' +
            '<th>Thao tác</th>' +
          '</tr></thead><tbody>';

        for (var i = 0; i < students.length; i++) {
          var s = students[i];
          var dateStr = s.lastExamDate ? formatDate(s.lastExamDate) : 'Chưa thi';
          html += '<tr>' +
            '<td><a href="javascript:void(0)" class="admin-student-link" data-name="' + escapeAttr(s.name) + '">' + escapeHtml(s.displayName) + '</a></td>' +
            '<td>' + s.examCount + '</td>' +
            '<td>' + s.averageScore + '</td>' +
            '<td>' + dateStr + '</td>' +
            '<td><button class="admin-btn-delete" data-name="' + escapeAttr(s.name) + '">🗑️ Xóa</button></td>' +
          '</tr>';
        }

        html += '</tbody></table>';
        table.innerHTML = html;
        contentArea.appendChild(table);

        // Event: click student name
        var links = table.querySelectorAll('.admin-student-link');
        for (var l = 0; l < links.length; l++) {
          (function (link) {
            link.addEventListener('click', function () {
              renderStudentDetail(contentArea, link.getAttribute('data-name'));
            });
          })(links[l]);
        }

        // Event: delete student
        var delBtns = table.querySelectorAll('.admin-btn-delete');
        for (var d = 0; d < delBtns.length; d++) {
          (function (btn) {
            btn.addEventListener('click', function () {
              var name = btn.getAttribute('data-name');
              if (!confirm('Xóa toàn bộ dữ liệu của học sinh "' + name + '"?')) return;
              var pin = prompt('Nhập mã PIN để xác nhận:');
              if (!pin) return;

              fetch('/api/students/' + encodeURIComponent(name), {
                method: 'DELETE',
                headers: { 'x-admin-pin': pin }
              })
              .then(function (res) { return res.json(); })
              .then(function (result) {
                if (result.success) {
                  alert('Đã xóa thành công');
                  renderStudentList(contentArea);
                } else {
                  alert(result.error || 'Lỗi xóa dữ liệu');
                }
              })
              .catch(function () { alert('Không thể kết nối máy chủ'); });
            });
          })(delBtns[d]);
        }
      })
      .catch(function () {
        contentArea.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-state-icon">❌</div>' +
            '<p>Không thể kết nối máy chủ</p>' +
          '</div>';
      });
  }

  function renderStudentDetail(contentArea, studentName) {
    contentArea.innerHTML = '<div class="loading">Đang tải chi tiết...</div>';

    Promise.all([
      fetch('/api/students/' + encodeURIComponent(studentName) + '/history').then(function (r) { return r.json(); }),
      fetch('/api/students/' + encodeURIComponent(studentName) + '/progress').then(function (r) { return r.json(); })
    ])
    .then(function (results) {
      var historyData = results[0];
      var progressData = results[1];
      contentArea.innerHTML = '';

      // Back button
      var backBtn = document.createElement('button');
      backBtn.className = 'btn-secondary';
      backBtn.textContent = '⬅️ Quay lại danh sách';
      backBtn.style.marginBottom = '20px';
      backBtn.addEventListener('click', function () { renderStudentList(contentArea); });
      contentArea.appendChild(backBtn);

      var title = document.createElement('h2');
      title.style.cssText = 'font-size:1.3rem;font-weight:700;margin-bottom:20px;';
      title.textContent = '📋 Chi tiết: ' + studentName;
      contentArea.appendChild(title);

      // Exam history
      var history = historyData.history || [];
      var histSection = document.createElement('div');
      histSection.className = 'admin-detail-section';
      histSection.innerHTML = '<h3>📝 Lịch sử thi (' + history.length + ' bài)</h3>';

      if (history.length === 0) {
        histSection.innerHTML += '<p style="color:var(--text-muted);padding:12px;">Chưa có bài thi nào</p>';
      } else {
        var histHtml = '<table class="admin-table"><thead><tr>' +
          '<th>Ngày</th><th>Điểm</th><th>Kết quả</th><th>Đúng/Tổng</th><th>Thời gian</th>' +
          '</tr></thead><tbody>';
        for (var i = 0; i < history.length; i++) {
          var h = history[i];
          var mins = Math.floor((h.timeSpent || 0) / 60);
          var secs = (h.timeSpent || 0) % 60;
          histHtml += '<tr>' +
            '<td>' + formatDate(h.date) + '</td>' +
            '<td>' + (h.score || 0) + '/1000</td>' +
            '<td><span class="admin-badge ' + (h.passed ? 'badge-pass' : 'badge-fail') + '">' + (h.passed ? 'Đạt' : 'Chưa đạt') + '</span></td>' +
            '<td>' + (h.correctCount || 0) + '/' + (h.totalQuestions || 0) + '</td>' +
            '<td>' + mins + 'p ' + secs + 's</td>' +
          '</tr>';
        }
        histHtml += '</tbody></table>';
        histSection.innerHTML += histHtml;
      }
      contentArea.appendChild(histSection);

      // Review progress
      var progress = progressData.progress || {};
      var progSection = document.createElement('div');
      progSection.className = 'admin-detail-section';
      var moduleKeys = Object.keys(progress);
      progSection.innerHTML = '<h3>📖 Tiến trình ôn tập (' + moduleKeys.length + ' module)</h3>';

      if (moduleKeys.length === 0) {
        progSection.innerHTML += '<p style="color:var(--text-muted);padding:12px;">Chưa có tiến trình ôn tập</p>';
      } else {
        for (var m = 0; m < moduleKeys.length; m++) {
          var modKey = moduleKeys[m];
          var mod = progress[modKey];
          var correctCount = (mod.answeredCorrectly || []).length;
          progSection.innerHTML +=
            '<div class="admin-progress-item">' +
              '<span class="admin-progress-label">' + escapeHtml(modKey) + '</span>' +
              '<span class="admin-progress-value">' + correctCount + ' câu đúng</span>' +
              '<span class="admin-progress-date">Lần cuối: ' + formatDate(mod.lastAttemptDate) + '</span>' +
            '</div>';
        }
      }
      contentArea.appendChild(progSection);
    })
    .catch(function () {
      contentArea.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">❌</div>' +
          '<p>Không thể tải dữ liệu</p>' +
        '</div>';
    });
  }

  function renderSettings(contentArea) {
    contentArea.innerHTML = '';

    var card = document.createElement('div');
    card.className = 'admin-settings-card';
    card.innerHTML =
      '<h3>🔑 Đổi mã PIN</h3>' +
      '<div class="admin-pin-change-form">' +
        '<input type="password" id="currentPinInput" class="sn-input" placeholder="Mã PIN hiện tại" maxlength="6" />' +
        '<input type="password" id="newPinInput" class="sn-input" placeholder="Mã PIN mới (4-6 chữ số)" maxlength="6" />' +
        '<div id="changePinMsg" class="admin-pin-msg" style="display:none;"></div>' +
        '<button id="changePinBtn" class="sn-confirm-btn">💾 Đổi mã PIN</button>' +
      '</div>';
    contentArea.appendChild(card);

    var currentInput = document.getElementById('currentPinInput');
    var newInput = document.getElementById('newPinInput');
    var msgEl = document.getElementById('changePinMsg');
    var btn = document.getElementById('changePinBtn');

    btn.addEventListener('click', function () {
      var currentPin = currentInput.value;
      var newPin = newInput.value;
      msgEl.style.display = 'none';

      if (!currentPin || !newPin) {
        msgEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
        msgEl.className = 'admin-pin-msg error';
        msgEl.style.display = 'block';
        return;
      }

      if (!/^\d{4,6}$/.test(newPin)) {
        msgEl.textContent = 'Mã PIN phải gồm 4-6 chữ số';
        msgEl.className = 'admin-pin-msg error';
        msgEl.style.display = 'block';
        return;
      }

      btn.disabled = true;
      fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin: currentPin, newPin: newPin })
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        btn.disabled = false;
        if (data.success) {
          msgEl.textContent = '✅ Đổi mã PIN thành công!';
          msgEl.className = 'admin-pin-msg success';
          currentInput.value = '';
          newInput.value = '';
        } else {
          msgEl.textContent = data.error || 'Mã PIN hiện tại không đúng';
          msgEl.className = 'admin-pin-msg error';
        }
        msgEl.style.display = 'block';
      })
      .catch(function () {
        btn.disabled = false;
        msgEl.textContent = 'Không thể kết nối máy chủ';
        msgEl.className = 'admin-pin-msg error';
        msgEl.style.display = 'block';
      });
    });
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

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text || ''));
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return (text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.AdminView = { render: render };
})();
