/* ── ConsoleSplit Renderer ────────────────────────────────────────────────── */

const api = window.electronAPI;

// ── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  fontSize:   13,
  shell:      '',
  defaultDir: 'C:\\',
  scrollback: 5000,
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

// ── State ────────────────────────────────────────────────────────────────────

let tabs = [];
let panes = {};
let activeTabId  = null;
let activePaneId = null;
let profiles = [];
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

  api.onPtyData(({ id, data }) => {
    const pane = getPaneByPtyId(id);
    if (pane) pane.term.write(data);
  });

  api.onPtyExit(({ id }) => {
    const pane = getPaneByPtyId(id);
    if (pane) pane.term.write(`\r\n\x1b[31m${t('term.exit')}\x1b[0m\r\n`);
  });

  createTab();
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

  const fontField = document.createElement('div');
  fontField.className = 'modal-field';
  fontField.innerHTML = `<label>${t('settings.fontSize')}</label>`;
  const rr = document.createElement('div'); rr.className = 'range-row';
  const fontRange = document.createElement('input');
  fontRange.type = 'range'; fontRange.min = 10; fontRange.max = 20; fontRange.value = s.fontSize;
  const fontVal = document.createElement('span'); fontVal.className = 'range-value'; fontVal.textContent = s.fontSize + 'px';
  fontRange.oninput = () => { s.fontSize = +fontRange.value; fontVal.textContent = s.fontSize + 'px'; };
  rr.appendChild(fontRange); rr.appendChild(fontVal); fontField.appendChild(rr);

  const shellField = document.createElement('div');
  shellField.className = 'modal-field';
  shellField.innerHTML = `<label>${t('settings.shell')}</label>`;
  const shellSelect = document.createElement('select');
  [
    { value: '',              label: 'System default (cmd.exe)' },
    { value: 'cmd.exe',       label: 'CMD (cmd.exe)' },
    { value: 'powershell.exe',label: 'Windows PowerShell' },
    { value: 'pwsh.exe',      label: 'PowerShell 7 (pwsh)' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label; opt.selected = s.shell === value;
    shellSelect.appendChild(opt);
  });
  shellSelect.onchange = () => { s.shell = shellSelect.value; };
  shellField.appendChild(shellSelect);

  const dirField = document.createElement('div');
  dirField.className = 'modal-field';
  dirField.innerHTML = `<label>${t('settings.defaultDir')}</label>`;
  const dirRow = document.createElement('div'); dirRow.className = 'dir-row';
  const dirInput = document.createElement('input'); dirInput.type = 'text'; dirInput.value = s.defaultDir;
  dirInput.oninput = () => { s.defaultDir = dirInput.value; };
  const dirBtn = document.createElement('button'); dirBtn.textContent = '📁';
  dirBtn.onclick = async () => { const d = await api.openDir(); if (d) { dirInput.value = d; s.defaultDir = d; } };
  dirRow.appendChild(dirInput); dirRow.appendChild(dirBtn); dirField.appendChild(dirRow);

  const scrollField = document.createElement('div');
  scrollField.className = 'modal-field';
  scrollField.innerHTML = `<label>${t('settings.scrollback')}</label>`;
  const sr = document.createElement('div'); sr.className = 'range-row';
  const scrollRange = document.createElement('input');
  scrollRange.type = 'range'; scrollRange.min = 1000; scrollRange.max = 50000; scrollRange.step = 1000; scrollRange.value = s.scrollback;
  const scrollVal = document.createElement('span'); scrollVal.className = 'range-value'; scrollVal.textContent = s.scrollback.toLocaleString();
  scrollRange.oninput = () => { s.scrollback = +scrollRange.value; scrollVal.textContent = s.scrollback.toLocaleString(); };
  sr.appendChild(scrollRange); sr.appendChild(scrollVal); scrollField.appendChild(sr);

  body.appendChild(fontField);
  body.appendChild(shellField);
  body.appendChild(dirField);
  body.appendChild(scrollField);

  openModal({
    title: t('settings.title'),
    body,
    footerButtons: [
      { label: t('settings.cancel'), onClick: closeModal },
      { label: t('settings.save'), primary: true, onClick: () => { settings = s; saveSettings(settings); closeModal(); } },
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
    if (e.ctrlKey && e.key === 't') { e.preventDefault(); createTab(); }
    if (e.ctrlKey && e.key === 'w') { e.preventDefault(); closeActiveTab(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'H') { e.preventDefault(); simpleSplit('horizontal'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'V') { e.preventDefault(); simpleSplit('vertical'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); saveCurrentAsProfile(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'G') { e.preventDefault(); redirectAllConsoles(); }
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

  const topbar = document.createElement('div');
  topbar.className = 'pane-topbar';

  const pathSpan = document.createElement('span');
  pathSpan.className = 'pane-path';
  pathSpan.title = cwd;
  pathSpan.textContent = cwd;

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
    }
  };

  const btnClose = document.createElement('button');
  btnClose.className = 'btn-close-pane';
  btnClose.textContent = '✕';
  btnClose.title = t('pane.close');
  btnClose.onclick = () => closePaneInTab(tabId, paneId);

  topbar.appendChild(pathSpan);
  topbar.appendChild(btnDir);
  topbar.appendChild(btnClose);

  const xtermContainer = document.createElement('div');
  xtermContainer.className = 'xterm-container';

  paneEl.appendChild(topbar);
  paneEl.appendChild(xtermContainer);

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

  const term = new Terminal({
    theme: {
      background: '#0d0d1a', foreground: '#e0e0f0',
      cursor: '#7c6af7', cursorAccent: '#0d0d1a',
      selectionBackground: 'rgba(124,106,247,0.3)',
      black: '#1a1a2e', red: '#e05c6a', green: '#56cfbc', yellow: '#f5c542',
      blue: '#7c6af7', magenta: '#c56af5', cyan: '#56cfbc', white: '#e0e0f0',
      brightBlack: '#44445a', brightRed: '#ff7b85', brightGreen: '#7dffd3',
      brightYellow: '#ffd27d', brightBlue: '#a08fff', brightMagenta: '#e08fff',
      brightCyan: '#7dffd3', brightWhite: '#ffffff',
    },
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
  term.open(xtermContainer);

  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      const sel = term.getSelection();
      if (sel) navigator.clipboard.writeText(sel);
      return false;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      navigator.clipboard.readText().then(text => {
        if (text) api.ptyWrite({ id: ptyId, data: text });
      });
      return false;
    }
    return true;
  });

  xtermContainer.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const sel = term.getSelection();
    if (sel) { await navigator.clipboard.writeText(sel); term.clearSelection(); }
    else {
      const text = await navigator.clipboard.readText().catch(() => '');
      if (text) api.ptyWrite({ id: ptyId, data: text });
    }
  });

  let lineBuffer = '';
  term.onData((data) => {
    if (data === '\r') {
      const cmd = lineBuffer.trim();
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

  panes[paneId] = { term, fitAddon, ptyId, path: cwd, tabId, el: paneEl };
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

  new ResizeObserver(() => {
    try { fitAddon.fit(); api.ptyResize({ id: ptyId, cols: term.cols, rows: term.rows }); }
    catch (_) {}
  }).observe(paneEl);

  return paneId;
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
  try { api.ptyKill({ id: pane.ptyId }); } catch (_) {}
  try { pane.term.dispose(); } catch (_) {}
  pane.el.remove();
  delete panes[paneId];
}

function closePaneInTab(tabId, paneId) {
  const tab = getTab(tabId);
  if (!tab || tab.panes.length <= 1) return;
  destroyPane(paneId);
  tab.panes = tab.panes.filter(id => id !== paneId);
  destroyTabSplits(tab);
  const area = document.querySelector(`[data-tab-area="${tabId}"]`);
  if (area) {
    const paneEls = tab.panes.map(id => panes[id]?.el).filter(Boolean);
    area.innerHTML = '';
    area.style.flexDirection = 'row';
    paneEls.forEach(el => area.appendChild(el));
    if (tab.panes.length > 1) {
      tab.splitInstances.push(makeSplit(
        paneEls, 'horizontal',
        () => requestAnimationFrame(() => refitTabPanes(tabId))
      ));
    }
  }
  if (activePaneId === paneId && tab.panes.length > 0) setActivePane(tab.panes[0]);
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
    // Wipe area to remove any stale grid-col wrappers, then re-attach existing panes
    const paneEls = tab.panes.map(id => panes[id]?.el).filter(Boolean);
    area.innerHTML = '';
    area.style.flexDirection = direction === 'vertical' ? 'column' : 'row';
    paneEls.forEach(el => area.appendChild(el));
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
  renderHistory();
}

function renderHistory() {
  const list   = document.getElementById('history-list');
  const filter = document.getElementById('history-search').value.toLowerCase();
  list.innerHTML = '';
  commandHistory.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    if (filter && !item.cmd.toLowerCase().includes(filter)) li.style.display = 'none';
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
  document.getElementById('btn-clear-history').onclick = () => { commandHistory = []; renderHistory(); };
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
    const snap = profile.tabs[i];
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
