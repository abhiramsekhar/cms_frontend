/**
 * Clinova Healthcare — Topbar Component
 *
 * Renders the header bar with:
 *  - Hamburger (< 1024px)
 *  - Search box (visual only for now)
 *  - Notification bell with dropdown
 *  - User menu with Log out
 */

import { db } from '../data/db.js';
import { auth } from '../api/auth.js';

function icon(id, cls = '') {
  return `<svg class="icon${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="${getBasePath()}assets/icons/sprite.svg#${id}"></use></svg>`;
}

function getBasePath() {
  const path = window.location.pathname;
  const idx = path.indexOf('/frontend/');
  if (idx === -1) return './';
  const rest = path.slice(idx + '/frontend/'.length);
  const depth = rest.split('/').filter(Boolean).length - 1;
  return depth > 0 ? '../'.repeat(depth) : './';
}

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  DOCTOR: 'Doctor',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
  LAB_TECH: 'Lab Technician',
};

/**
 * Render the topbar into the given container element.
 */
export function renderTopbar(container, session) {
  const base = getBasePath();
  const initials = session.staffName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const roleLabel = ROLE_LABELS[session.role] || session.role;

  // Get unread notification count
  let unreadCount = 0;
  try {
    const notifications = db.getAll('notifications');
    unreadCount = notifications.filter(n => {
      if (n.isRead) return false;
      if (n.targetUserId && n.targetUserId !== session.userId) return false;
      if (n.targetRole && n.targetRole !== session.role) return false;
      return true;
    }).length;
  } catch { /* ignore */ }

  container.innerHTML = `
    <div class="topbar__left">
      <button class="hamburger" id="sidebar-toggle" aria-label="Toggle sidebar">
        ${icon('icon-menu')}
      </button>
      <div class="search-bar" id="global-search">
        <span class="search-bar__icon">${icon('icon-search', 'icon--sm')}</span>
        <input type="text" class="search-bar__input" placeholder="Search patients, appointments…" aria-label="Search" id="search-input">
        <kbd class="search-bar__kbd">⌘K</kbd>
      </div>
    </div>
    <div class="topbar__right">
      <div class="notification-bell dropdown" id="notification-area">
        <button class="btn btn--ghost btn--icon" id="notification-btn" aria-label="Notifications" aria-expanded="false">
          ${icon('icon-bell')}
          ${unreadCount > 0 ? `<span class="notification-bell__count">${unreadCount > 9 ? '9+' : unreadCount}</span>` : ''}
        </button>
        <div class="notification-dropdown dropdown__menu" id="notification-dropdown">
          <div class="notification-dropdown__header">
            <span class="text-card-title">Notifications</span>
            <button class="btn btn--ghost btn--sm" id="mark-all-read">Mark all read</button>
          </div>
          <div class="notification-dropdown__list" id="notification-list">
          </div>
          <div class="notification-dropdown__footer">
            <span class="text-caption">End of notifications</span>
          </div>
        </div>
      </div>

      <div class="dropdown" id="user-menu-area">
        <button class="topbar__user" id="user-menu-btn" aria-expanded="false">
          <div class="avatar avatar--sm" aria-hidden="true">${initials}</div>
          <div class="topbar__user-info">
            <span class="topbar__user-name">${session.staffName}</span>
            <span class="topbar__user-role">${roleLabel}</span>
          </div>
          ${icon('icon-chevron-down', 'icon--sm')}
        </button>
        <div class="dropdown__menu" id="user-dropdown">
          <div style="padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border);">
            <div style="font-weight: 500; font-size: 0.875rem; color: var(--text);">${session.staffName}</div>
            <div style="font-size: 0.75rem; color: var(--muted);">${roleLabel} · ${session.username}</div>
          </div>
          <button class="dropdown__item dropdown__item--danger" id="logout-btn">
            ${icon('icon-log-out')}
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Populate notification list
  populateNotifications(session);

  // Event listeners
  setupTopbarEvents(session);
}

function populateNotifications(session) {
  const listEl = document.getElementById('notification-list');
  if (!listEl) return;

  let notifications = [];
  try {
    notifications = db.getAll('notifications').filter(n => {
      if (n.targetUserId && n.targetUserId !== session.userId) return false;
      if (n.targetRole && n.targetRole !== session.role) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  } catch { /* ignore */ }

  if (notifications.length === 0) {
    listEl.innerHTML = `
      <div style="padding: var(--sp-8) var(--sp-4); text-align: center;">
        <span class="text-caption">No notifications</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = notifications.map(n => `
    <div class="notification-item ${n.isRead ? '' : 'is-unread'}" data-id="${n.id}">
      ${n.isRead ? '<div style="width:8px;flex-shrink:0;"></div>' : '<div class="notification-item__dot"></div>'}
      <div class="notification-item__content">
        <div class="notification-item__title">${n.title}</div>
        <div class="notification-item__text">${n.message}</div>
        <div class="notification-item__time">${formatRelativeTime(n.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function setupTopbarEvents(session) {
  const base = getBasePath();

  // Sidebar toggle
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.toggle('is-open');
    overlay?.classList.toggle('is-visible');
  });

  // Notification dropdown
  const notifBtn = document.getElementById('notification-btn');
  const notifDropdown = document.getElementById('notification-dropdown');
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle('is-open');
    // Close user menu
    document.getElementById('user-dropdown')?.classList.remove('is-open');
  });

  // Mark all read
  document.getElementById('mark-all-read')?.addEventListener('click', () => {
    try {
      const notifications = db.getAll('notifications');
      for (const n of notifications) {
        if (!n.isRead) {
          db.update('notifications', n.id, { isRead: true, _v: n._v });
        }
      }
      // Refresh
      const countEl = document.querySelector('.notification-bell__count');
      if (countEl) countEl.remove();
      populateNotifications(session);
    } catch { /* ignore */ }
  });

  // User menu dropdown
  const userBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle('is-open');
    // Close notification dropdown
    notifDropdown?.classList.remove('is-open');
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    auth.logout();
    window.location.href = base + 'pages/login/index.html';
  });

  // Close dropdowns on click outside
  document.addEventListener('click', () => {
    notifDropdown?.classList.remove('is-open');
    userDropdown?.classList.remove('is-open');
  });

  // Close sidebar overlay
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('is-open');
    document.getElementById('sidebar-overlay')?.classList.remove('is-visible');
  });
}
