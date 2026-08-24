/* ── ConsoleSplit Renderer ────────────────────────────────────────────────── */

const api = window.electronAPI;

// ── Themes ────────────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    background: '#0d0d1a', foreground: '#e0e0f0',
    cursor: '#7c6af7', cursorAccent: '#0d0d1a',
    selectionBackground: 'rgba(124,106,247,0.3)',
    black: '#1a1a2e', red: '#e05c6a', green: '#56cfbc', yellow: '#f5c542',
    blue: '#7c6af7', magenta: '#c56af5', cyan: '#56cfbc', white: '#e0e0f0',
    brightBlack: '#44445a', brightRed: '#ff7b85', brightGreen: '#7dffd3',
    brightYellow: '#ffd27d', brightBlue: '#a08fff', brightMagenta: '#e08fff',
    brightCyan: '#7dffd3', brightWhite: '#ffffff',
  },
  dracula: {
    background: '#282a36', foreground: '#f8f8f2',
    cursor: '#f8f8f2', cursorAccent: '#282a36',
    selectionBackground: 'rgba(68,71,90,0.6)',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
    brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
    brightCyan: '#a4ffff', brightWhite: '#ffffff',
  },
  nord: {
    background: '#2e3440', foreground: '#d8dee9',
    cursor: '#88c0d0', cursorAccent: '#2e3440',
    selectionBackground: 'rgba(136,192,208,0.3)',
    black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
    blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb', brightWhite: '#eceff4',
  },
  light: {
    background: '#f5f5f5', foreground: '#1e1e1e',
    cursor: '#5555cc', cursorAccent: '#f5f5f5',
    selectionBackground: 'rgba(85,85,204,0.2)',
    black: '#000000', red: '#cc0000', green: '#008800', yellow: '#888800',
    blue: '#0000cc', magenta: '#880088', cyan: '#008888', white: '#888888',
    brightBlack: '#555555', brightRed: '#ff5555', brightGreen: '#55aa55',
    brightYellow: '#aaaa00', brightBlue: '#5555ff', brightMagenta: '#ff55ff',
    brightCyan: '#55ffff', brightWhite: '#ffffff',
  },
};

// ── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  fontSize:   13,
  shell:      '',
  defaultDir: 'C:\\',
  scrollback: 5000,
  theme:      'dark',
};

function loadSettings() {
  try {
    const raw = localStorage.getItem('consolesplit-settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveSettings(s) { localStorage.setItem('consolesplit-settings', JSON.stringify(s)); }

let settings = loadSettings();

// ── History persistence ───────────────────────────────────────────────────────

function loadHistoryFromStorage() {
  try {
    const raw = localStorage.getItem('consolesplit-history');
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

function saveHistoryToStorage() {
  try {
    localStorage.setItem('consolesplit-history', JSON.stringify(commandHistory.slice(0, 500)));
  } catch (_) {}
}

// ── Session persistence ───────────────────────────────────────────────────────

function saveSessionToStorage() {
  try {
    const session = tabs.map(tab => ({
      label:    tab.label,
      layoutId: tab.layoutId || 'single',
      panes:    tab.panes.map(id => ({ path: panes[id]?.path || settings.defaultDir })),
    }));
    localStorage.setItem('consolesplit-session', JSON.stringify(session));
  } catch (_) {}
}

function loadSessionFromStorage() {
  try {
    const raw = localStorage.getItem('consolesplit-session');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// ── Theme helpers ─────────────────────────────────────────────────────────────

function applyThemeToAllPanes() {
  const theme = THEMES[settings.theme] || THEMES.dark;
  Object.values(panes).forEach(p => {
    try { p.term.options.theme = theme; } catch (_) {}
  });
}

// ── Zoom helpers ──────────────────────────────────────────────────────────────

function applyZoomDelta(delta) {
  const next = Math.min(24, Math.max(8, settings.fontSize + delta));
  if (next === settings.fontSize) return;
  settings.fontSize = next;
  saveSettings(settings);
  Object.values(panes).forEach(p => {
    try {
      p.term.options.fontSize = next;
      requestAnimationFrame(() => {
        p.fitAddon.fit();
        api.ptyResize({ id: p.ptyId, cols: p.term.cols, rows: p.term.rows });
      });
    } catch (_) {}
  });
}

function resetZoom() {
  settings.fontSize = DEFAULT_SETTINGS.fontSize;
  saveSettings(settings);
  Object.values(panes).forEach(p => {
    try {
      p.term.options.fontSize = DEFAULT_SETTINGS.fontSize;
      requestAnimationFrame(() => {
        p.fitAddon.fit();
        api.ptyResize({ id: p.ptyId, cols: p.term.cols, rows: p.term.rows });
      });
    } catch (_) {}
  });
}

// ── Pane navigation ───────────────────────────────────────────────────────────

function navigatePaneByDirection(direction) {
  if (!activePaneId || !activeTabId) return;
  const tab = getTab(activeTabId);
  if (!tab || tab.panes.length < 2) return;

  const cur = panes[activePaneId];
  if (!cur) return;
  const cr = cur.el.getBoundingClientRect();
  const cx = cr.left + cr.width / 2;
  const cy = cr.top  + cr.height / 2;

  let best = null;
  let bestScore = Infinity;

  tab.panes.forEach(id => {
    if (id === activePaneId) return;
    const p = panes[id];
    if (!p) return;
    const r = p.el.getBoundingClientRect();
    const dx = (r.left + r.width  / 2) - cx;
    const dy = (r.top  + r.height / 2) - cy;
    let score = Infinity;
    if (direction === 'right' && dx >  5) score = dx  + Math.abs(dy) * 0.4;
    if (direction === 'left'  && dx < -5) score = -dx + Math.abs(dy) * 0.4;
    if (direction === 'down'  && dy >  5) score = dy  + Math.abs(dx) * 0.4;
    if (direction === 'up'    && dy < -5) score = -dy + Math.abs(dx) * 0.4;
    if (score < bestScore) { bestScore = score; best = id; }
  });

  if (best) setActivePane(best);
}

// ── State ────────────────────────────────────────────────────────────────────

let tabs          = [];
let panes         = {};
let activeTabId   = null;
let activePaneId  = null;
let profiles      = [];
let commandHistory = [];
let ptyIdCounter  = 0;
let tabIdCounter  = 0;
let paneIdCounter = 0;

// ── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
  applyTranslations();
  setupWindowControls();
  setupGlobalShortcuts();
  setupTabBarButtons();
  setupHistoryUI();
  setupSidebarUI();

  profiles = await api.loadProfiles();
  renderProfiles();

  commandHistory = loadHistoryFromStorage();
  renderHistory();

  api.onPtyData(({ id, data }) => {
    const pane = getPaneByPtyId(id);
    if (pane) pane.term.write(data);
  });

  api.onPtyExit(({ id }) => {
    const pane = getPaneByPtyId(id);
    if (pane) pane.term.write(`\r\n\x1b[31m${t('term.exit')}\x1b[0m\r\n`);
  });

  await createTab();

  const session = loadSessionFromStorage();
  if (session && session.length > 0) {
    await loadProfile({ tabs: session });
  }

  applyThemeToAllPanes();
  window.addEventListener('beforeunload', saveSessionToStorage);
})();

// ── IDs ──────────────────────────────────────────────────────────────────────

function newTabId()  { return `tab-${++tabIdCounter}`; }
function newPaneId() { return `pane-${++paneIdCounter}`; }
function newPtyId()  { return `pty-${++ptyIdCounter}`; }

// ── Lookup ───────────────────────────────────────────────────────────────────

function getPaneByPtyId(ptyId) {
  return Object.values(panes).find(p => p.ptyId === ptyId) || null;
}
function getTab(tabId) { return tabs.find(t => t.id === tabId); }

// ── Modal system ──────────────────────────────────────────────────────────────

let _modalResolve = null;

function openModal({ title, body, footerButtons }) {
  document.getElementById('modal-title').textContent = title;
  const mb = document.getElementById('modal-body');
  mb.innerHTML = '';
  mb.appendChild(body);

  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';
  footerButtons.forEach(({ label, primary, onClick }) => {
    const btn = document.createElement('button');
    btn.className = 'btn-modal' + (primary ? ' primary' : '');
    btn.textContent = label;
    btn.onclick = onClick;
    footer.appendChild(btn);
  });

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  if (_modalResolve) { _modalResolve(null); _modalResolve = null; }
}

function promptModal(titleKey, placeholderKey) {
  return new Promise((resolve) => {
    _modalResolve = resolve;

    const body = document.createElement('div');
    body.className = 'modal-field';
    const label = document.createElement('label');
    label.textContent = t(titleKey);
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = t(placeholderKey);
    input.style.marginTop = '4px';
    body.appendChild(label);
    body.appendChild(input);

    const commit = () => {
      const val = input.value.trim();
      _modalResolve = null;
      closeModal();
      resolve(val || null);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  commit();
      if (e.key === 'Escape') { _modalResolve = null; closeModal(); resolve(null); }
    });

    openModal({
      title: t(titleKey),
      body,
      footerButtons: [
        { label: t('modal.cancel'), onClick: () => { _modalResolve = null; closeModal(); resolve(null); } },
        { label: t('modal.save'),   primary: true, onClick: commit },
      ],
    });

    requestAnimationFrame(() => input.focus());
  });
}

// ── Settings modal ────────────────────────────────────────────────────────────

function openSettingsModal() {
  const s = { ...settings };

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:14px';

  // Font size
  const fontField = document.createElement('div');
  fontField.className = 'modal-field';
  fontField.innerHTML = `<label>${t('settings.fontSize')}</label>`;
  const rr = document.createElement('div'); rr.className = 'range-row';
  const fontRange = document.createElement('input');
  fontRange.type = 'range'; fontRange.min = 8; fontRange.max = 24; fontRange.value = s.fontSize;
  const fontVal = document.createElement('span'); fontVal.className = 'range-value'; fontVal.textContent = s.fontSize + 'px';
  fontRange.oninput = () => { s.fontSize = +fontRange.value; fontVal.textContent = s.fontSize + 'px'; };
  rr.appendChild(fontRange); rr.appendChild(fontVal); fontField.appendChild(rr);

  // Shell
  const shellField = document.createElement('div');
  shellField.className = 'modal-field';
  shellField.innerHTML = `<label>${t('settings.shell')}</label>`;
  const shellSelect = document.createElement('select');
  [
    { value: '',               label: 'System default (cmd.exe)' },
    { value: 'cmd.exe',        label: 'CMD (cmd.exe)' },
    { value: 'powershell.exe', label: 'Windows PowerShell' },
    { value: 'pwsh.exe',       label: 'PowerShell 7 (pwsh)' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label; opt.selected = s.shell === value;
    shellSelect.appendChild(opt);
  });
  shellSelect.onchange = () => { s.shell = shellSelect.value; };
  shellField.appendChild(shellSelect);

  // Default dir
  const dirField = document.createElement('div');
  dirField.className = 'modal-field';
  dirField.innerHTML = `<label>${t('settings.defaultDir')}</label>`;
  const dirRow = document.createElement('div'); dirRow.className = 'dir-row';
  const dirInput = document.createElement('input'); dirInput.type = 'text'; dirInput.value = s.defaultDir;
  dirInput.oninput = () => { s.defaultDir = dirInput.value; };
  const dirBtn = document.createElement('button'); dirBtn.textContent = '📁';
  dirBtn.onclick = async () => { const d = await api.openDir(); if (d) { dirInput.value = d; s.defaultDir = d; } };
  dirRow.appendChild(dirInput); dirRow.appendChild(dirBtn); dirField.appendChild(dirRow);

  // Scrollback
  const scrollField = document.createElement('div');
  scrollField.className = 'modal-field';
  scrollField.innerHTML = `<label>${t('settings.scrollback')}</label>`;
  const sr = document.createElement('div'); sr.className = 'range-row';
  const scrollRange = document.createElement('input');
  scrollRange.type = 'range'; scrollRange.min = 1000; scrollRange.max = 50000; scrollRange.step = 1000; scrollRange.value = s.scrollback;
  const scrollVal = document.createElement('span'); scrollVal.className = 'range-value'; scrollVal.textContent = s.scrollback.toLocaleString();
  scrollRange.oninput = () => { s.scrollback = +scrollRange.value; scrollVal.textContent = s.scrollback.toLocaleString(); };
  sr.appendChild(scrollRange); sr.appendChild(scrollVal); scrollField.appendChild(sr);

  // Theme
  const themeField = document.createElement('div');
  themeField.className = 'modal-field';
  themeField.innerHTML = `<label>${t('settings.theme')}</label>`;
  const themeSelect = document.createElement('select');
  [
    { value: 'dark',    label: 'Dark (default)' },
    { value: 'dracula', label: 'Dracula' },
    { value: 'nord',    label: 'Nord' },
    { value: 'light',   label: 'Light' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label; opt.selected = s.theme === value;
    themeSelect.appendChild(opt);
  });
  themeSelect.onchange = () => { s.theme = themeSelect.value; };
  themeField.appendChild(themeSelect);

  body.appendChild(fontField);
  body.appendChild(shellField);
  body.appendChild(dirField);
  body.appendChild(scrollField);
  body.appendChild(themeField);

  openModal({
    title: t('settings.title'),
    body,
    footerButtons: [
      { label: t('settings.cancel'), onClick: closeModal },
      { label: t('settings.save'), primary: true, onClick: () => {
        settings = s;
        saveSettings(settings);
        applyThemeToAllPanes();
        closeModal();
      }},
    ],
  });
}

// ── Grid layout engine ────────────────────────────────────────────────────────

function toggleLayoutPicker() {
  document.getElementById('layout-picker').classList.toggle('hidden');
}

function hideLayoutPicker() {
  document.getElementById('layout-picker').classList.add('hidden');
}

function setupLayoutPicker() {
  document.getElementById('btn-layout').onclick = (e) => {
    e.stopPropagation();
    toggleLayoutPicker();
  };

  document.querySelectorAll('.lp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layoutId = btn.dataset.layout;
      hideLayoutPicker();
      applyGridLayout(activeTabId, layoutId);
    });
  });

  document.addEventListener('click', hideLayoutPicker);
  document.getElementById('layout-picker').addEventListener('click', e => e.stopPropagation());
}

function destroyTabSplits(tab) {
  (tab.splitInstances || []).forEach(s => { try { s.destroy(); } catch (_) {} });
  tab.splitInstances = [];
}

function refitTabPanes(tabId) {
  const tab = getTab(tabId);
  if (!tab) return;
  tab.panes.forEach(id => {
    const p = panes[id];
    if (p) {
      try { p.fitAddon.fit(); api.ptyResize({ id: p.ptyId, cols: p.term.cols, rows: p.term.rows }); }
      catch (_) {}
    }
  });
}

function makeSplit(elements, direction, onDragEnd) {
  const sizes = elements.map(() => 100 / elements.length);
  return Split(elements, { direction, sizes, minSize: 80, gutterSize: 4, onDragEnd });
}

function mkCol(parent) {
  const div = document.createElement('div');
  div.className = 'grid-col';
  parent.appendChild(div);
  return div;
}

async function applyGridLayout(tabId, layoutId) {
  const tab = getTab(tabId);
  if (!tab) return;

  const oldPaths = tab.panes.map(id => panes[id]?.path || settings.defaultDir);

  destroyTabSplits(tab);
  [...tab.panes].forEach(id => destroyPane(id));
  tab.panes = [];
  tab.layoutId = layoutId;

  const area = document.querySelector(`[data-tab-area="${tabId}"]`);
  if (!area) return;
  area.innerHTML = '';
  area.style.flexDirection = 'row';

  const def = settings.defaultDir || 'C:\\';
  const path = (i) => oldPaths[i] || def;
  const onRefit = () => requestAnimationFrame(() => refitTabPanes(tabId));

  const mkPane = async (parent, cwd) => {
    const id = await addPane(tabId, cwd, parent);
    return panes[id];
  };

  switch (layoutId) {

    case 'single': {
      await mkPane(area, path(0));
      break;
    }

    case 'cols2': {
      const [a, b] = await Promise.all([mkPane(area, path(0)), mkPane(area, path(1))]);
      tab.splitInstances.push(makeSplit([a.el, b.el], 'horizontal', onRefit));
      break;
    }

    case 'rows2': {
      area.style.flexDirection = 'column';
      const [a, b] = await Promise.all([mkPane(area, path(0)), mkPane(area, path(1))]);
      tab.splitInstances.push(makeSplit([a.el, b.el], 'vertical', onRefit));
      break;
    }

    case 'grid22': {
      const col1 = mkCol(area);
      const col2 = mkCol(area);
      const [a, b] = await Promise.all([mkPane(col1, path(0)), mkPane(col1, path(1))]);
      const [c, d] = await Promise.all([mkPane(col2, path(2)), mkPane(col2, path(3))]);
      tab.splitInstances.push(makeSplit([col1, col2], 'horizontal', onRefit));
      tab.splitInstances.push(makeSplit([a.el, b.el], 'vertical',   onRefit));
      tab.splitInstances.push(makeSplit([c.el, d.el], 'vertical',   onRefit));
      break;
    }

    case 'cols3': {
      const [a, b, c] = await Promise.all([mkPane(area, path(0)), mkPane(area, path(1)), mkPane(area, path(2))]);
      tab.splitInstances.push(makeSplit([a.el, b.el, c.el], 'horizontal', onRefit));
      break;
    }

    case 'rows3': {
      area.style.flexDirection = 'column';
      const [a, b, c] = await Promise.all([mkPane(area, path(0)), mkPane(area, path(1)), mkPane(area, path(2))]);
      tab.splitInstances.push(makeSplit([a.el, b.el, c.el], 'vertical', onRefit));
      break;
    }

    case 'main-r2': {
      const left  = mkCol(area);
      const right = mkCol(area);
      const a = await mkPane(left, path(0));
      const [b, c] = await Promise.all([mkPane(right, path(1)), mkPane(right, path(2))]);
      tab.splitInstances.push(makeSplit([left, right], 'horizontal', onRefit));
      tab.splitInstances.push(makeSplit([b.el, c.el],  'vertical',   onRefit));
      try { tab.splitInstances[0].setSizes([60, 40]); } catch (_) {}
      break;
    }

    case 'l2-main': {
      const left  = mkCol(area);
      const right = mkCol(area);
      const [a, b] = await Promise.all([mkPane(left, path(0)), mkPane(left, path(1))]);
      const c = await mkPane(right, path(2));
      tab.splitInstances.push(makeSplit([left, right], 'horizontal', onRefit));
      tab.splitInstances.push(makeSplit([a.el, b.el],  'vertical',   onRefit));
      try { tab.splitInstances[0].setSizes([40, 60]); } catch (_) {}
      break;
    }
  }

  setTimeout(() => refitTabPanes(tabId), 80);
  if (tab.panes.length > 0) setActivePane(tab.panes[0]);
}

// ── Redirect all consoles ─────────────────────────────────────────────────────

async function redirectAllConsoles() {
  const newDir = await api.openDir();
  if (!newDir) return;
  const tab = getTab(activeTabId);
  if (!tab) return;
  tab.panes.forEach(paneId => {
    const pane = panes[paneId];
    if (!pane) return;
    pane.path = newDir;
    const pathSpan = pane.el.querySelector('.pane-path');
    if (pathSpan) { pathSpan.textContent = newDir; pathSpan.title = newDir; }
    api.ptyWrite({ id: pane.ptyId, data: `cd /d "${newDir}"\r` });
    refreshGitBranch(paneId);
  });
}

// ── Window controls ───────────────────────────────────────────────────────────

function setupWindowControls() {
  document.getElementById('btn-minimize').onclick = () => api.windowMinimize();
  document.getElementById('btn-maximize').onclick = () => api.windowMaximize();
  document.getElementById('btn-close').onclick    = () => api.windowClose();
  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function setupGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (e.key === 't') { e.preventDefault(); createTab(); return; }
      if (e.key === 'w') { e.preventDefault(); closeActiveTab(); return; }
      if (e.key === '=' || e.key === '+') { e.preventDefault(); applyZoomDelta(+1); return; }
      if (e.key === '-') { e.preventDefault(); applyZoomDelta(-1); return; }
      // Ctrl+1–9 y Ctrl+0 → ir al panel por índice (0 = décimo panel)
      if (/^[0-9]$/.test(e.key)) {
        const tab = getTab(activeTabId);
        if (tab && tab.panes.length > 1) {
          const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
          if (idx < tab.panes.length) { e.preventDefault(); setActivePane(tab.panes[idx]); return; }
        }
      }
    }
    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      if (e.key === 'H') { e.preventDefault(); simpleSplit('horizontal'); return; }
      if (e.key === 'V') { e.preventDefault(); simpleSplit('vertical'); return; }
      if (e.key === 'S') { e.preventDefault(); saveCurrentAsProfile(); return; }
      if (e.key === 'G') { e.preventDefault(); redirectAllConsoles(); return; }
      if (e.key === 'D') { e.preventDefault(); duplicateTab(); return; }
    }
    if (e.key === 'Escape') { closeModal(); hideLayoutPicker(); }
  });
}

// ── Tab bar buttons ───────────────────────────────────────────────────────────

function setupTabBarButtons() {
  document.getElementById('btn-new-tab').onclick        = () => createTab();
  document.getElementById('btn-split-h').onclick        = () => simpleSplit('horizontal');
  document.getElementById('btn-split-v').onclick        = () => simpleSplit('vertical');
  document.getElementById('btn-redirect-all').onclick   = redirectAllConsoles;
  document.getElementById('btn-save-profile').onclick   = saveCurrentAsProfile;
  document.getElementById('btn-toggle-sidebar').onclick = toggleSidebar;
  document.getElementById('btn-toggle-history').onclick = toggleHistory;
  document.getElementById('btn-settings').onclick       = openSettingsModal;
  document.getElementById('btn-lang').onclick           = () => {
    cycleLang();
    renderTabBar();
    renderProfiles();
    renderHistory();
  };
  setupLayoutPicker();
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

async function createTab(label = null, cwdOverride = null) {
  const tabId = newTabId();
  const tab = {
    id: tabId,
    label: label || `${t('tab.defaultName')} ${tabs.length + 1}`,
    panes: [],
    splitInstances: [],
    layoutId: 'single',
  };
  tabs.push(tab);
  activeTabId = tabId;
  renderTabBar();

  const cwd = cwdOverride || settings.defaultDir || 'C:\\';
  await addPane(tabId, cwd);
  return tabId;
}

async function duplicateTab() {
  const tab = getTab(activeTabId);
  if (!tab) return;

  const snapshot = {
    label:    tab.label,
    layoutId: tab.layoutId || 'single',
    panes:    tab.panes.map(id => ({ path: panes[id]?.path || settings.defaultDir })),
  };

  const tabId = await createTab(snapshot.label);
  await applyGridLayout(tabId, snapshot.layoutId);
  getTab(tabId).panes.forEach((paneId, j) => {
    const p = panes[paneId];
    if (!p || !snapshot.panes[j]) return;
    p.path = snapshot.panes[j].path;
    api.ptyWrite({ id: p.ptyId, data: `cd /d "${snapshot.panes[j].path}"\r` });
    const ps = p.el.querySelector('.pane-path');
    if (ps) { ps.textContent = snapshot.panes[j].path; ps.title = snapshot.panes[j].path; }
    refreshGitBranch(paneId);
  });
}

function activateTab(tabId) {
  activeTabId = tabId;
  document.querySelectorAll('[data-tab-area]').forEach(el => {
    el.style.display = el.dataset.tabArea === tabId ? 'flex' : 'none';
  });
  renderTabBar();
  const tab = getTab(tabId);
  if (tab && tab.panes.length > 0) setActivePane(tab.panes[0]);
}

function closeActiveTab() {
  if (tabs.length <= 1) return;
  const tab = getTab(activeTabId);
  if (!tab) return;

  destroyTabSplits(tab);
  tab.panes.forEach(id => destroyPane(id));

  const area = document.querySelector(`[data-tab-area="${tab.id}"]`);
  if (area) area.remove();
  tabs = tabs.filter(t => t.id !== tab.id);

  if (tabs.length > 0) activateTab(tabs[tabs.length - 1].id);
  renderTabBar();
}

function renderTabBar() {
  const container = document.getElementById('tabs-container');
  container.innerHTML = '';

  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
    el.dataset.tabId = tab.id;

    const dot = document.createElement('span');
    dot.className = 'tab-dot';

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = tab.label;

    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.className = 'tab-label-input';
      input.value = tab.label;
      label.replaceWith(input);
      input.focus(); input.select();

      const commit = () => {
        tab.label = input.value.trim() || tab.label;
        input.replaceWith(label);
        label.textContent = tab.label;
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter')  input.blur();
        if (ev.key === 'Escape') { input.value = tab.label; input.blur(); }
      });
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close-tab';
    closeBtn.textContent = '✕';
    closeBtn.title = t('tab.close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tabs.length <= 1) return;
      const closing = tab.id;
      if (activeTabId === closing) {
        const other = tabs.find(t => t.id !== closing);
        if (other) activateTab(other.id);
      }
      const tObj = getTab(closing);
      if (tObj) { destroyTabSplits(tObj); tObj.panes.forEach(id => destroyPane(id)); }
      const area = document.querySelector(`[data-tab-area="${closing}"]`);
      if (area) area.remove();
      tabs = tabs.filter(t => t.id !== closing);
      renderTabBar();
    });

    el.appendChild(dot);
    el.appendChild(label);
    el.appendChild(closeBtn);
    el.addEventListener('click', () => activateTab(tab.id));
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      activateTab(tab.id);
      duplicateTab();
    });
    container.appendChild(el);
  });
}

// ── Panes ─────────────────────────────────────────────────────────────────────

async function addPane(tabId, cwd, parentEl = null) {
  const paneId = newPaneId();
  const ptyId  = newPtyId();
  const tab    = getTab(tabId);
  if (!tab) return;

  const paneEl = document.createElement('div');
  paneEl.className = 'terminal-pane';
  paneEl.dataset.paneId = paneId;

  // ── Topbar ──
  const topbar = document.createElement('div');
  topbar.className = 'pane-topbar';

  const pathSpan = document.createElement('span');
  pathSpan.className = 'pane-path';
  pathSpan.title = cwd;
  pathSpan.textContent = cwd;

  const branchSpan = document.createElement('span');
  branchSpan.className = 'pane-git-branch';
  branchSpan.style.display = 'none';

  const btnDir = document.createElement('button');
  btnDir.className = 'btn-pane-dir';
  btnDir.textContent = '📁';
  btnDir.title = t('pane.changeDir');
  btnDir.onclick = async () => {
    const newDir = await api.openDir();
    if (newDir) {
      pathSpan.textContent = newDir;
      pathSpan.title = newDir;
      panes[paneId].path = newDir;
      api.ptyWrite({ id: ptyId, data: `cd /d "${newDir}"\r` });
      refreshGitBranch(paneId);
    }
  };

  const btnClose = document.createElement('button');
  btnClose.className = 'btn-close-pane';
  btnClose.textContent = '✕';
  btnClose.title = t('pane.close');
  btnClose.onclick = () => closePaneInTab(tabId, paneId);

  topbar.appendChild(pathSpan);
  topbar.appendChild(branchSpan);
  topbar.appendChild(btnDir);
  topbar.appendChild(btnClose);

  // ── Search bar ──
  const searchBar = document.createElement('div');
  searchBar.className = 'pane-search hidden';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'pane-search-input';
  searchInput.placeholder = 'Buscar... (Enter / Shift+Enter)';

  const searchPrev = document.createElement('button');
  searchPrev.className = 'pane-search-btn';
  searchPrev.title = 'Anterior';
  searchPrev.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/></svg>';

  const searchNext = document.createElement('button');
  searchNext.className = 'pane-search-btn';
  searchNext.title = 'Siguiente';
  searchNext.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>';

  const searchClose = document.createElement('button');
  searchClose.className = 'pane-search-btn';
  searchClose.title = 'Cerrar';
  searchClose.textContent = '✕';

  searchBar.appendChild(searchInput);
  searchBar.appendChild(searchPrev);
  searchBar.appendChild(searchNext);
  searchBar.appendChild(searchClose);

  // ── xterm container ──
  const xtermContainer = document.createElement('div');
  xtermContainer.className = 'xterm-container';

  paneEl.appendChild(topbar);
  paneEl.appendChild(searchBar);
  paneEl.appendChild(xtermContainer);

  // ── Insert into DOM ──
  if (parentEl) {
    parentEl.appendChild(paneEl);
  } else {
    let area = document.querySelector(`[data-tab-area="${tabId}"]`);
    if (!area) {
      area = document.createElement('div');
      area.className = 'pane-wrapper';
      area.dataset.tabArea = tabId;
      area.style.display = 'flex';
      document.getElementById('terminal-area').appendChild(area);
    }
    area.appendChild(paneEl);
  }

  document.querySelectorAll('[data-tab-area]').forEach(el => {
    el.style.display = el.dataset.tabArea === activeTabId ? 'flex' : 'none';
  });

  // ── Terminal ──
  const theme = THEMES[settings.theme] || THEMES.dark;
  const term = new Terminal({
    theme,
    fontFamily:  "'Cascadia Code','Cascadia Mono','Consolas',monospace",
    fontSize:    settings.fontSize,
    lineHeight:  1.35,
    scrollback:  settings.scrollback,
    allowProposedApi: true,
    cursorBlink: true,
    cursorStyle: 'bar',
    windowsMode: true,
    rightClickSelectsWord: false,
  });

  const fitAddon   = new FitAddon.FitAddon();
  const linksAddon = new WebLinksAddon.WebLinksAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(linksAddon);

  let searchAddon = null;
  if (typeof SearchAddon !== 'undefined') {
    searchAddon = new SearchAddon.SearchAddon();
    term.loadAddon(searchAddon);
  }

  term.open(xtermContainer);

  // Previene el cursor de "recorte" que Windows activa al mantener Alt
  xtermContainer.addEventListener('mousedown', (e) => {
    if (e.altKey) e.preventDefault();
  }, true);

  // ── Search bar wiring ──
  const searchOpts = { caseSensitive: false };

  const openSearch = () => {
    searchBar.classList.remove('hidden');
    requestAnimationFrame(() => searchInput.focus());
  };
  const closeSearch = () => {
    searchBar.classList.add('hidden');
    term.focus();
  };

  searchInput.addEventListener('input', () => {
    if (searchAddon && searchInput.value) {
      searchAddon.findNext(searchInput.value, searchOpts);
    }
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchAddon) return;
      if (e.shiftKey) searchAddon.findPrevious(searchInput.value, searchOpts);
      else            searchAddon.findNext(searchInput.value, searchOpts);
    }
  });
  searchPrev.onclick = () => searchAddon?.findPrevious(searchInput.value, searchOpts);
  searchNext.onclick = () => searchAddon?.findNext(searchInput.value, searchOpts);
  searchClose.onclick = closeSearch;

  // ── Key handler ──
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;

    // Ctrl+1–9 y Ctrl+0 → navegar a panel por índice
    if (e.ctrlKey && !e.shiftKey && !e.altKey && /^[0-9]$/.test(e.key)) {
      const currentTab = getTab(activeTabId);
      if (currentTab && currentTab.panes.length > 1) {
        const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
        if (idx < currentTab.panes.length) {
          setActivePane(currentTab.panes[idx]);
          return false;
        }
      }
      return false; // capturar siempre para no enviar al terminal
    }

    // Ctrl+F — toggle search
    if (e.ctrlKey && !e.shiftKey && e.key === 'f') {
      if (searchBar.classList.contains('hidden')) openSearch();
      else closeSearch();
      return false;
    }

    // Ctrl+Backspace — delete previous word using tracked lineBuffer
    // Sends N backspaces (\x7f) instead of \x17 so funciona en cmd.exe también
    if (e.ctrlKey && e.key === 'Backspace') {
      const wordMatch = lineBuffer.match(/\S+\s*$/);
      if (wordMatch) {
        const n = wordMatch[0].length;
        api.ptyWrite({ id: ptyId, data: '\x7f'.repeat(n) });
        lineBuffer = lineBuffer.slice(0, lineBuffer.length - n);
      }
      return false;
    }

    // Ctrl+Shift+C — copy selection
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      const sel = term.getSelection();
      if (sel) navigator.clipboard.writeText(sel);
      return false;
    }

    // Ctrl+Shift+V — paste
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      navigator.clipboard.readText().then(text => {
        if (text) {
          api.ptyWrite({ id: ptyId, data: text });
          const lastNl = Math.max(text.lastIndexOf('\r'), text.lastIndexOf('\n'));
          lineBuffer = lastNl >= 0 ? text.slice(lastNl + 1) : lineBuffer + text;
        }
      });
      return false;
    }

    return true;
  });

  // ── Right-click: copy if selection, paste otherwise ──
  // Usar fase de captura (tercer arg = true) para interceptar ANTES de que el
  // evento llegue al canvas interno de xterm, evitando que ambos handlers peguen.
  xtermContainer.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    e.stopPropagation(); // evita que xterm procese el mismo evento
    const sel = term.getSelection();
    if (sel) { await navigator.clipboard.writeText(sel); term.clearSelection(); }
    else {
      const text = await navigator.clipboard.readText().catch(() => '');
      if (text) {
        api.ptyWrite({ id: ptyId, data: text });
        const lastNl = Math.max(text.lastIndexOf('\r'), text.lastIndexOf('\n'));
        lineBuffer = lastNl >= 0 ? text.slice(lastNl + 1) : lineBuffer + text;
      }
    }
  }, true); // true = capture phase

  // ── Command history capture ──
  let lineBuffer = '';
  term.onData((data) => {
    if (data === '\r') {
      const cmd = lineBuffer.trim();

      // Traducir 'clear' a 'cls' en cmd.exe (clear no es un comando válido en cmd)
      const isCmdExe = !settings.shell || settings.shell === 'cmd.exe';
      if (cmd.toLowerCase() === 'clear' && isCmdExe) {
        // Borrar 'clear' del buffer del shell y escribir 'cls' en su lugar
        api.ptyWrite({ id: ptyId, data: '\x7f'.repeat(lineBuffer.length) + 'cls\r' });
        addToHistory('cls', tab.label);
        lineBuffer = '';
        return;
      }

      if (cmd) addToHistory(cmd, tab.label);
      lineBuffer = '';
    } else if (data === '\x7f') {
      lineBuffer = lineBuffer.slice(0, -1);
    } else if (!data.startsWith('\x1b')) {
      lineBuffer += data;
    }
    api.ptyWrite({ id: ptyId, data });
  });

  paneEl.addEventListener('click', () => setActivePane(paneId));

  // Track colEl for smart close-pane behavior
  const colEl = (parentEl && parentEl.classList && parentEl.classList.contains('grid-col'))
    ? parentEl : null;

  panes[paneId] = { term, fitAddon, searchAddon, ptyId, path: cwd, tabId, el: paneEl, colEl, observer: null };
  tab.panes.push(paneId);

  const result = await api.ptyCreate({ id: ptyId, cwd, shell: settings.shell || undefined });
  if (!result.success) {
    term.write(`\x1b[31m${t('term.error')} ${result.error}\x1b[0m\r\n`);
  }

  requestAnimationFrame(() => {
    try { fitAddon.fit(); api.ptyResize({ id: ptyId, cols: term.cols, rows: term.rows }); }
    catch (_) {}
  });

  setActivePane(paneId);

  const observer = new ResizeObserver(() => {
    try { fitAddon.fit(); api.ptyResize({ id: ptyId, cols: term.cols, rows: term.rows }); }
    catch (_) {}
  });
  observer.observe(paneEl);
  panes[paneId].observer = observer;

  // Async git branch (don't block pane creation)
  refreshGitBranch(paneId);

  return paneId;
}

async function refreshGitBranch(paneId) {
  const pane = panes[paneId];
  if (!pane) return;
  const branch = await api.getGitBranch(pane.path).catch(() => null);
  const el = pane.el.querySelector('.pane-git-branch');
  if (!el) return;
  if (branch) {
    el.textContent = `⎇ ${branch}`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

function setActivePane(paneId) {
  activePaneId = paneId;
  document.querySelectorAll('.terminal-pane').forEach(el => {
    el.classList.toggle('focused', el.dataset.paneId === paneId);
  });
  const pane = panes[paneId];
  if (pane) pane.term.focus();
}

function destroyPane(paneId) {
  const pane = panes[paneId];
  if (!pane) return;
  try { pane.observer?.disconnect(); } catch (_) {}
  try { api.ptyKill({ id: pane.ptyId }); } catch (_) {}
  try { pane.term.dispose(); } catch (_) {}
  pane.el.remove();
  delete panes[paneId];
}

function closePaneInTab(tabId, paneId) {
  const tab = getTab(tabId);
  if (!tab || tab.panes.length <= 1) return;

  const pane  = panes[paneId];
  const colEl = pane?.colEl ?? null;

  destroyPane(paneId);
  tab.panes = tab.panes.filter(id => id !== paneId);
  destroyTabSplits(tab);

  const area = document.querySelector(`[data-tab-area="${tabId}"]`);
  if (!area) {
    if (activePaneId === paneId && tab.panes.length > 0) setActivePane(tab.panes[0]);
    return;
  }

  const onRefit = () => requestAnimationFrame(() => refitTabPanes(tabId));

  if (tab.panes.length === 1) {
    // One pane left: show it full in area, strip col wrapper
    const remaining = panes[tab.panes[0]];
    area.innerHTML = '';
    area.style.flexDirection = 'row';
    if (remaining) {
      remaining.colEl = null;
      area.appendChild(remaining.el);
    }

  } else if (colEl && colEl.isConnected) {
    // Pane was inside a grid-col — try to preserve column structure
    const panesInSameCol = tab.panes.filter(id => panes[id]?.colEl === colEl);

    if (panesInSameCol.length === 0) {
      // Column is now empty: remove it, rebuild horizontal split with remaining cols
      colEl.remove();
      const allCols  = [...new Set(tab.panes.map(id => panes[id]?.colEl).filter(Boolean))];
      const flatPanes = tab.panes.filter(id => !panes[id]?.colEl).map(id => panes[id].el);
      const elements  = [...allCols, ...flatPanes];
      if (elements.length > 1) tab.splitInstances.push(makeSplit(elements, 'horizontal', onRefit));
    } else {
      // Column still has panes — rebuild its vertical split
      if (panesInSameCol.length > 1) {
        const colPaneEls = panesInSameCol.map(id => panes[id].el);
        tab.splitInstances.push(makeSplit(colPaneEls, 'vertical', onRefit));
      }
      // Rebuild horizontal split across all columns
      const allCols  = [...new Set(tab.panes.map(id => panes[id]?.colEl).filter(Boolean))];
      const flatPanes = tab.panes.filter(id => !panes[id]?.colEl).map(id => panes[id].el);
      const elements  = [...allCols, ...flatPanes];
      if (elements.length > 1) tab.splitInstances.push(makeSplit(elements, 'horizontal', onRefit));
    }

  } else {
    // Flat layout — rebuild horizontal split
    const paneEls = tab.panes.map(id => panes[id]?.el).filter(Boolean);
    area.innerHTML = '';
    area.style.flexDirection = 'row';
    paneEls.forEach(el => area.appendChild(el));
    if (paneEls.length > 1) tab.splitInstances.push(makeSplit(paneEls, 'horizontal', onRefit));
  }

  if (activePaneId === paneId && tab.panes.length > 0) setActivePane(tab.panes[0]);
  setTimeout(() => refitTabPanes(tabId), 50);
}

// ── Simple split (H/V toolbar buttons) ───────────────────────────────────────

async function simpleSplit(direction) {
  if (!activePaneId || !activeTabId) return;
  const tab = getTab(activeTabId);
  if (!tab) return;

  const cwd = panes[activePaneId]?.path || settings.defaultDir;
  destroyTabSplits(tab);

  const area = document.querySelector(`[data-tab-area="${activeTabId}"]`);
  if (area) {
    const paneEls = tab.panes.map(id => panes[id]?.el).filter(Boolean);
    area.innerHTML = '';
    area.style.flexDirection = direction === 'vertical' ? 'column' : 'row';
    paneEls.forEach(el => area.appendChild(el));
    // Clear colEl since we're flattening
    tab.panes.forEach(id => { if (panes[id]) panes[id].colEl = null; });
  }

  await addPane(activeTabId, cwd);

  const elements = tab.panes.map(id => panes[id]?.el).filter(Boolean);
  if (elements.length > 1) {
    tab.splitInstances.push(makeSplit(elements, direction,
      () => requestAnimationFrame(() => refitTabPanes(activeTabId))
    ));
  }
}

// ── History ───────────────────────────────────────────────────────────────────

function addToHistory(cmd, tabLabel) {
  const time = new Date().toTimeString().slice(0, 5);
  commandHistory.unshift({ time, tabLabel, cmd });
  saveHistoryToStorage();
  renderHistory();
}

function renderHistory() {
  const list   = document.getElementById('history-list');
  const filter = document.getElementById('history-search').value.toLowerCase();
  list.innerHTML = '';
  commandHistory.forEach((item) => {
    if (filter && !item.cmd.toLowerCase().includes(filter)) return;
    const li = document.createElement('li');
    li.className = 'history-item';
    li.title = t('history.rerun');

    const time  = document.createElement('span'); time.className  = 'hi-time'; time.textContent  = item.time;
    const tabEl = document.createElement('span'); tabEl.className = 'hi-tab';  tabEl.textContent = item.tabLabel;
    const cmd   = document.createElement('span'); cmd.className   = 'hi-cmd';  cmd.textContent   = item.cmd;

    li.appendChild(time); li.appendChild(tabEl); li.appendChild(cmd);
    li.addEventListener('click', () => {
      if (activePaneId && panes[activePaneId]) {
        api.ptyWrite({ id: panes[activePaneId].ptyId, data: item.cmd + '\r' });
      }
    });
    list.appendChild(li);
  });
}

function setupHistoryUI() {
  document.getElementById('history-search').addEventListener('input', renderHistory);
  document.getElementById('btn-clear-history').onclick = () => {
    commandHistory = [];
    saveHistoryToStorage();
    renderHistory();
  };
  document.getElementById('btn-close-history').onclick = toggleHistory;
}

function toggleHistory() {
  document.getElementById('history-panel').classList.toggle('collapsed');
  setTimeout(() => refitTabPanes(activeTabId), 220);
}

// ── Profiles / Sidebar ────────────────────────────────────────────────────────

function setupSidebarUI() {
  document.getElementById('btn-add-profile').onclick = saveCurrentAsProfile;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  setTimeout(() => refitTabPanes(activeTabId), 220);
}

async function saveCurrentAsProfile() {
  const name = await promptModal('modal.profileName', 'modal.profilePlaceholder');
  if (!name) return;

  const snapshot = tabs.map(tab => ({
    label:    tab.label,
    layoutId: tab.layoutId || 'single',
    panes: tab.panes.map(id => ({ path: panes[id]?.path || settings.defaultDir })),
  }));

  profiles.push({ name, tabs: snapshot, created: new Date().toISOString() });
  await api.saveProfiles(profiles);
  renderProfiles();
}

async function loadProfile(profile) {
  while (tabs.length > 1) {
    const last = tabs[tabs.length - 1];
    destroyTabSplits(last);
    last.panes.forEach(id => destroyPane(id));
    const area = document.querySelector(`[data-tab-area="${last.id}"]`);
    if (area) area.remove();
    tabs.pop();
  }
  if (tabs.length === 1) {
    const tObj = tabs[0];
    destroyTabSplits(tObj);
    tObj.panes.forEach(id => destroyPane(id));
    tObj.panes = [];
    tObj.splitInstances = [];
    const area = document.querySelector(`[data-tab-area="${tObj.id}"]`);
    if (area) { area.innerHTML = ''; area.style.flexDirection = 'row'; }
    tObj.label = profile.tabs[0]?.label || `${t('tab.defaultName')} 1`;
  }

  for (let i = 0; i < profile.tabs.length; i++) {
    const snap  = profile.tabs[i];
    const paths = snap.panes.map(p => p.path);

    if (i === 0 && tabs.length === 1) {
      tabs[0].label = snap.label;
      activeTabId = tabs[0].id;
      await applyGridLayout(tabs[0].id, snap.layoutId || 'single');
      tabs[0].panes.forEach((paneId, j) => {
        if (paths[j] && panes[paneId]) {
          panes[paneId].path = paths[j];
          api.ptyWrite({ id: panes[paneId].ptyId, data: `cd /d "${paths[j]}"\r` });
          const ps = panes[paneId].el.querySelector('.pane-path');
          if (ps) { ps.textContent = paths[j]; ps.title = paths[j]; }
          refreshGitBranch(paneId);
        }
      });
    } else {
      const tabId = await createTab(snap.label);
      await applyGridLayout(tabId, snap.layoutId || 'single');
      getTab(tabId).panes.forEach((paneId, j) => {
        if (paths[j] && panes[paneId]) {
          panes[paneId].path = paths[j];
          api.ptyWrite({ id: panes[paneId].ptyId, data: `cd /d "${paths[j]}"\r` });
          const ps = panes[paneId].el.querySelector('.pane-path');
          if (ps) { ps.textContent = paths[j]; ps.title = paths[j]; }
          refreshGitBranch(paneId);
        }
      });
    }
  }

  renderTabBar();
  activateTab(tabs[0].id);
}

async function deleteProfile(idx) {
  profiles.splice(idx, 1);
  await api.saveProfiles(profiles);
  renderProfiles();
}

function renderProfiles() {
  const list = document.getElementById('profile-list');
  list.innerHTML = '';

  if (profiles.length === 0) {
    const empty = document.createElement('li');
    empty.style.cssText = 'padding:14px;color:var(--text-dim);font-size:12px;text-align:center;';
    empty.textContent = t('sidebar.empty');
    list.appendChild(empty);
    return;
  }

  profiles.forEach((profile, idx) => {
    const li = document.createElement('li');
    li.className = 'profile-item';

    const name = document.createElement('span');
    name.className = 'profile-name';
    name.textContent = profile.name;

    const tabCount = document.createElement('span');
    tabCount.className = 'profile-tabs';
    tabCount.textContent = `${profile.tabs?.length || 0}t`;

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-del-profile';
    delBtn.textContent = '✕';
    delBtn.title = t('sidebar.delete');
    delBtn.onclick = (e) => { e.stopPropagation(); deleteProfile(idx); };

    li.appendChild(name); li.appendChild(tabCount); li.appendChild(delBtn);
    li.onclick = () => loadProfile(profile);
    list.appendChild(li);
  });
}
