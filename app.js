/**
 * WorkFlow Board — Vanilla JS Kanban
 * Features: Drag & Drop, LocalStorage, Event-driven, CRUD
 * Author: Fidan Teymurova
 */

// ─── State ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'workflow_tasks';

const COLUMNS = ['todo', 'inprogress', 'review', 'done'];

const TAG_LABELS = {
  js:     'Vanilla JS',
  api:    'REST API',
  dom:    'DOM',
  event:  'Event',
  config: 'Config',
  test:   'Testing',
};

const PRIORITY_LABELS = {
  low:    '↓ Low',
  medium: '→ Med',
  high:   '↑ High',
};

// In-memory state — loaded from localStorage on init
let tasks = [];
let draggedId = null;
let editingId = null;

// ─── Utility ──────────────────────────────────────────────────────────────────

function generateId() {
  return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : getDefaultTasks();
  } catch {
    tasks = getDefaultTasks();
  }
}

function getDefaultTasks() {
  return [
    { id: generateId(), title: 'DOM event system',         desc: 'Implement custom event bus using addEventListener.', priority: 'high',   tag: 'dom',   status: 'todo' },
    { id: generateId(), title: 'LocalStorage integration', desc: 'Persist board state across sessions.',               priority: 'medium', tag: 'js',    status: 'todo' },
    { id: generateId(), title: 'REST API fetch calls',     desc: 'GET/POST/DELETE with native fetch() API.',           priority: 'low',    tag: 'api',   status: 'todo' },
    { id: generateId(), title: 'Drag & Drop logic',        desc: 'Native HTML5 drag events — no library.',            priority: 'high',   tag: 'event', status: 'inprogress' },
    { id: generateId(), title: 'YAML metadata parser',     desc: 'Parse config files, build workflow metadata.',      priority: 'medium', tag: 'config',status: 'inprogress' },
    { id: generateId(), title: 'Project structure setup',  desc: 'Folder layout, naming conventions, git init.',      priority: 'low',    tag: 'js',    status: 'done' },
  ];
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

function qsa(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

function showToast(msg) {
  const existing = qs('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderBoard() {
  COLUMNS.forEach(col => {
    const list = document.getElementById(`list-${col}`);
    const colTasks = tasks.filter(t => t.status === col);

    list.innerHTML = '';

    if (colTasks.length === 0) {
      list.innerHTML = '<div class="empty-state">Drop tasks here</div>';
    } else {
      colTasks.forEach(task => {
        list.appendChild(createCardElement(task));
      });
    }

    document.getElementById(`badge-${col}`).textContent = colTasks.length;
  });

  updateStats();
}

function createCardElement(task) {
  const card = document.createElement('div');
  card.className = 'task-card' + (task.status === 'done' ? ' done-card' : '');
  card.dataset.id = task.id;
  card.draggable = true;

  card.innerHTML = `
    <div class="card-actions">
      <button class="btn-icon btn-edit" title="Edit" data-id="${task.id}">✎</button>
      <button class="btn-icon btn-delete" title="Delete" data-id="${task.id}">✕</button>
    </div>
    <div class="card-title">${escapeHtml(task.title)}</div>
    ${task.desc ? `<div class="card-desc">${escapeHtml(task.desc)}</div>` : ''}
    <div class="card-footer">
      <span class="tag tag-${task.tag}">${TAG_LABELS[task.tag] || task.tag}</span>
      <span class="priority priority-${task.priority}">${PRIORITY_LABELS[task.priority] || task.priority}</span>
    </div>
  `;

  // Drag events
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend',   onDragEnd);

  // Edit / Delete buttons
  qs('.btn-edit',   card).addEventListener('click', e => { e.stopPropagation(); openEditModal(task.id); });
  qs('.btn-delete', card).addEventListener('click', e => { e.stopPropagation(); deleteTask(task.id); });

  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateStats() {
  const total    = tasks.length;
  const inProg   = tasks.filter(t => t.status === 'inprogress').length;
  const done     = tasks.filter(t => t.status === 'done').length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-progress').textContent = inProg;
  document.getElementById('stat-done').textContent     = done;
  document.getElementById('stat-pct').textContent      = pct + '%';
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

function onDragStart(e) {
  draggedId = e.currentTarget.dataset.id;
  setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  draggedId = null;
  qsa('.column').forEach(col => col.classList.remove('drag-over'));
}

function setupColumnDropZones() {
  qsa('.column').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', e => {
      // Only remove class if leaving the column entirely
      if (!col.contains(e.relatedTarget)) {
        col.classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');

      if (!draggedId) return;

      const newStatus = col.dataset.status;
      const task = tasks.find(t => t.id === draggedId);
      if (task && task.status !== newStatus) {
        task.status = newStatus;
        saveTasks();
        renderBoard();
        showToast(`Moved to "${newStatus === 'inprogress' ? 'In Progress' : newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}"`);
      }
    });
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(prefillStatus = 'todo') {
  editingId = null;
  qs('#modal-title').textContent = 'New Task';
  qs('#input-title').value    = '';
  qs('#input-desc').value     = '';
  qs('#input-priority').value = 'medium';
  qs('#input-tag').value      = 'js';
  qs('#input-status').value   = prefillStatus;
  qs('#modal-overlay').classList.add('active');
  qs('#input-title').focus();
}

function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editingId = id;
  qs('#modal-title').textContent = 'Edit Task';
  qs('#input-title').value    = task.title;
  qs('#input-desc').value     = task.desc || '';
  qs('#input-priority').value = task.priority;
  qs('#input-tag').value      = task.tag;
  qs('#input-status').value   = task.status;
  qs('#modal-overlay').classList.add('active');
  qs('#input-title').focus();
}

function closeModal() {
  qs('#modal-overlay').classList.remove('active');
  editingId = null;
}

function saveModal() {
  const title = qs('#input-title').value.trim();
  if (!title) {
    qs('#input-title').focus();
    showToast('Task title is required!');
    return;
  }

  const data = {
    title,
    desc:     qs('#input-desc').value.trim(),
    priority: qs('#input-priority').value,
    tag:      qs('#input-tag').value,
    status:   qs('#input-status').value,
  };

  if (editingId) {
    const idx = tasks.findIndex(t => t.id === editingId);
    if (idx > -1) tasks[idx] = { ...tasks[idx], ...data };
    showToast('Task updated');
  } else {
    tasks.push({ id: generateId(), ...data });
    showToast('Task added');
  }

  saveTasks();
  renderBoard();
  closeModal();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderBoard();
  showToast('Task deleted');
}

function clearDone() {
  const count = tasks.filter(t => t.status === 'done').length;
  if (count === 0) { showToast('No done tasks to clear'); return; }
  tasks = tasks.filter(t => t.status !== 'done');
  saveTasks();
  renderBoard();
  showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''}`);
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function setupEvents() {
  // Header buttons
  qs('#btn-add-task').addEventListener('click', () => openModal());
  qs('#btn-clear-done').addEventListener('click', clearDone);

  // Modal buttons
  qs('#btn-save').addEventListener('click', saveModal);
  qs('#btn-cancel').addEventListener('click', closeModal);
  qs('#modal-close').addEventListener('click', closeModal);

  // Close modal on overlay click
  qs('#modal-overlay').addEventListener('click', e => {
    if (e.target === qs('#modal-overlay')) closeModal();
  });

  // Save on Enter key
  qs('#input-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveModal();
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Inline "Add task" buttons
  qsa('.btn-add-inline').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.col));
  });

  // Column drop zones
  setupColumnDropZones();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  loadTasks();
  renderBoard();
  setupEvents();
}

document.addEventListener('DOMContentLoaded', init);