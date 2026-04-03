/**
 * IC3 Spark — SPA Entry Point
 * Khởi tạo ứng dụng, kết nối Router với các View, render sidebar
 */
(function () {
  'use strict';

  // Dữ liệu toàn cục
  var appData = null; // { modules: [], questions: [] }

  /**
   * Khởi tạo ứng dụng khi trang tải xong
   */
  function init() {
    fetchData();
  }

  /**
   * Tải dữ liệu modules và câu hỏi từ API
   */
  function fetchData() {
    fetch('/api/questions')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        appData = data;
        renderSidebar();
        setupRouter();
        handleRoute(window.Router.getCurrentRoute());
      })
      .catch(function () {
        var list = document.getElementById('moduleList');
        if (list) {
          list.innerHTML =
            '<li style="padding:20px;color:#EF4444;text-align:center;">' +
              '❌ Lỗi kết nối máy chủ API! Vui lòng tải lại trang.' +
            '</li>';
        }
      });
  }

  /**
   * Render sidebar với danh sách module (clean white design)
   */
  function renderSidebar() {
    var list = document.getElementById('moduleList');
    if (!list || !appData || !appData.modules) return;

    list.innerHTML = '';

    // Đếm câu hỏi theo module
    var questionCounts = {};
    if (appData.questions) {
      for (var i = 0; i < appData.questions.length; i++) {
        var mod = appData.questions[i].module;
        questionCounts[mod] = (questionCounts[mod] || 0) + 1;
      }
    }

    for (var m = 0; m < appData.modules.length; m++) {
      var mod = appData.modules[m];
      var count = questionCounts[mod.id] || 0;

      var li = document.createElement('li');
      li.className = 'module-item';
      li.setAttribute('data-module-id', mod.id);

      // Title row: icon + title (compact for sidebar)
      var titleRow = document.createElement('div');
      titleRow.className = 'module-item-title';
      titleRow.innerHTML =
        '<span class="module-item-icon">' + (mod.icon || '📘') + '</span>' +
        '<span>' + escapeHtml(mod.title) + '</span>';
      li.appendChild(titleRow);

      // Info row (hidden in new design via CSS)
      var infoRow = document.createElement('div');
      infoRow.className = 'module-item-info';
      infoRow.textContent = '📝 ' + count + ' câu hỏi';
      li.appendChild(infoRow);

      // Actions row (hidden in new design via CSS)
      var actionsRow = document.createElement('div');
      actionsRow.className = 'module-item-actions';

      var reviewBtn = document.createElement('button');
      reviewBtn.className = 'btn-review';
      reviewBtn.textContent = '📖 Ôn tập';
      actionsRow.appendChild(reviewBtn);

      li.appendChild(actionsRow);

      (function (moduleId) {
        reviewBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          window.Router.navigateTo('#/review/' + moduleId);
        });
        li.addEventListener('click', function () {
          window.Router.navigateTo('#/review/' + moduleId);
        });
      })(mod.id);

      list.appendChild(li);
    }
  }

  /**
   * Đăng ký Router listener
   */
  function setupRouter() {
    window.Router.onRouteChange(function (route) {
      handleRoute(route);
    });
  }

  /**
   * Xử lý route — render view tương ứng
   */
  function handleRoute(route) {
    var container = document.getElementById('app');
    if (!container) return;

    // Exit exam mode when navigating away from exam
    if (route.name !== 'exam') {
      document.body.classList.remove('exam-mode');
    }

    updateActiveNavLink(route);
    updateActiveSidebarModule(route);
    updateStudentNameDisplay();

    // Intercept review/exam navigation — require student name
    if (route.name === 'review' || route.name === 'exam') {
      var currentName = window.StudentNameDialog ? window.StudentNameDialog.getCurrentName() : null;
      if (!currentName) {
        window.StudentNameDialog.show(function () {
          updateStudentNameDisplay();
          handleRoute(route);
        });
        return;
      }
    }

    switch (route.name) {
      case 'dashboard':
        window.DashboardView.render(container, appData);
        break;

      case 'review':
        var moduleId = route.params.moduleId;
        var filteredQuestions = filterQuestionsByModule(moduleId);
        window.ReviewModeView.render(container, moduleId, filteredQuestions);
        break;

      case 'exam':
        window.ExamModeView.render(container);
        break;

      case 'history':
        window.HistoryView.render(container, null);
        break;

      case 'historyDetail':
        window.HistoryView.render(container, route.params.examId);
        break;

      case 'admin':
        window.AdminView.render(container);
        break;

      case 'adminDetail':
        window.AdminView.render(container);
        break;

      default:
        window.DashboardView.render(container, appData);
        break;
    }
  }

  function filterQuestionsByModule(moduleId) {
    if (!appData || !appData.questions) return [];
    return appData.questions.filter(function (q) {
      return q.module === moduleId;
    });
  }

  function updateActiveNavLink(route) {
    var navLinks = document.querySelectorAll('.nav-link');
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].classList.remove('active');
    }

    // Show/hide admin link — only visible when on admin route
    var adminLink = document.querySelector('.nav-link-admin');
    if (adminLink) {
      adminLink.style.display = (route.name === 'admin' || route.name === 'adminDetail') ? 'flex' : 'none';
    }

    var routeToDataRoute = {
      dashboard: 'dashboard',
      review: 'dashboard',
      exam: 'exam',
      history: 'history',
      historyDetail: 'history',
      admin: 'admin',
      adminDetail: 'admin'
    };

    var dataRoute = routeToDataRoute[route.name] || 'dashboard';
    var activeLink = document.querySelector('.nav-link[data-route="' + dataRoute + '"]');
    if (activeLink) {
      activeLink.classList.add('active');
    }
  }

  function updateActiveSidebarModule(route) {
    var items = document.querySelectorAll('.module-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('active');
    }

    if (route.name === 'review' && route.params.moduleId) {
      var activeItem = document.querySelector('.module-item[data-module-id="' + route.params.moduleId + '"]');
      if (activeItem) {
        activeItem.classList.add('active');
      }
    }
  }

  /**
   * Hiển thị tên học sinh trên sidebar
   */
  function updateStudentNameDisplay() {
    var existing = document.getElementById('studentNameDisplay');
    if (existing) existing.remove();

    var studentName = window.StudentNameDialog ? window.StudentNameDialog.getCurrentName() : null;
    if (!studentName) return;

    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    var display = document.createElement('div');
    display.id = 'studentNameDisplay';
    display.className = 'student-name-display';

    var initial = studentName.charAt(0).toUpperCase();
    display.innerHTML =
      '<div class="student-name-row">' +
        '<div class="student-name-avatar">' + escapeHtml(initial) + '</div>' +
        '<span class="student-name-text">' + escapeHtml(studentName) + '</span>' +
        '<span class="student-name-edit" title="Đổi tên">✏️</span>' +
      '</div>' +
      '<button class="student-logout-btn" id="studentLogoutBtn">🚪 Đăng xuất</button>';

    // Click tên để đổi tên
    var nameRow = display.querySelector('.student-name-row');
    nameRow.addEventListener('click', function () {
      window.StudentNameDialog.show(function () {
        updateStudentNameDisplay();
      });
    });

    // Click đăng xuất
    var logoutBtn = display.querySelector('#studentLogoutBtn');
    logoutBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.StudentNameDialog.clearName();
      updateStudentNameDisplay();
      window.Router.navigateTo('#/');
    });

    // Insert after sidebar-logo
    var logo = sidebar.querySelector('.sidebar-logo');
    if (logo && logo.nextSibling) {
      sidebar.insertBefore(display, logo.nextSibling);
    } else {
      sidebar.appendChild(display);
    }
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  // Khởi tạo khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
