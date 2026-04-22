const API_BASE = '/api';

// Pages TAs cannot access — redirect to students.html
const TA_BLOCKED_PAGES = ['teacher.html', 'testgen.html'];

export async function checkAuth(options = {}) {
  const { requireRole = null, redirect = 'login.html' } = options;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });

    if (!res.ok) {
      window.location.href = redirect;
      return null;
    }

    const data = await res.json();
    const user = data.user;

    // Redirect TAs away from blocked pages
    if (user.role === 'ta') {
      const currentPage = window.location.pathname.split('/').pop();
      if (TA_BLOCKED_PAGES.includes(currentPage)) {
        window.location.href = 'students.html';
        return null;
      }
    }

    // Check role if required
    if (requireRole) {
      const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
      if (!allowed.includes(user.role)) {
        window.location.href = 'index.html';
        return null;
      }
    }

    updateNav(user);
    return user;

  } catch (err) {
    console.warn('Auth check failed:', err);
    window.location.href = redirect;
    return null;
  }
}

function updateNav(user) {
  const navLinks = document.querySelectorAll('.nav a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');

    if (user.role === 'student') {
      // Students: only see Labs
      if (href === 'teacher.html' || href === 'testgen.html' || href === 'students.html') {
        link.style.display = 'none';
      }
    }

    if (user.role === 'ta') {
      // TAs: only see Labs and Students
      if (href === 'teacher.html' || href === 'testgen.html') {
        link.style.display = 'none';
      }
    }

    // instructors see everything — no links hidden
  });

  // Wire up any existing logout buttons in the HTML
  ['logout-prof', 'logout-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', async () => {
        try {
          await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch (_) {}
        localStorage.removeItem('professorAuthed');
        window.location.href = 'login.html';
      });
    }
  });

  // Add user info + logout to nav if not already present
  const nav = document.querySelector('.nav');
  if (nav && !document.getElementById('nav-user-info')) {
    const userSpan = document.createElement('span');
    userSpan.id = 'nav-user-info';
    userSpan.style.cssText = 'font-size: 12px; color: #555; padding: 3px 8px;';
    userSpan.textContent = user.full_name || user.username;
    nav.appendChild(userSpan);

    const logoutBtn = document.createElement('a');
    logoutBtn.href = '#';
    logoutBtn.textContent = 'Log out';
    logoutBtn.style.cssText = 'cursor: pointer;';
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      } catch (_) {}
      localStorage.removeItem('professorAuthed');
      window.location.href = 'login.html';
    });
    nav.appendChild(logoutBtn);
  }
}