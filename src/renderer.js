/* ── ConsoleSplit Renderer ────────────────────────────────────────────────── */

const api = window.electronAPI;

// ── State ────────────────────────────────────────────────────────────────────

let tabs = [];
let panes = {};
let activeTabId = null;
let activePaneId = null;
let profiles = [];
let commandHistory = [];
let ptyIdCounter = 0;
let tabIdCounter = 0;
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
    if (pane) {
      pane.term.write(`\r\n\x1b[31m${t('term.exit')}\x1b[0m\r\n`);
    }
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

function getTab(tabId) {
  return tabs.find(t => t.id === tabId);
}

// ── Window controls ───────────────────────────────────────────────────────────

function setupWindowControls() {
  document.getElementById('btn-minimize').onclick = () => api.windowMinimize();
  document.getElementById('btn-maximize').onclick = () => api.windowMaximize();
  document.getElementById('btn-close').onclick    = () => api.windowClose();
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

function setupGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 't') { e.preventDefault(); createTab(); }
    if (e.ctrlKey && e.key === 'w') { e.preventDefault(); closeActiveTab(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'H') { e.preventDefault(); splitActivePane('horizontal'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'V') { e.preventDefault(); splitActivePane('vertical'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); saveCurrentAsProfile(); }
  });
}

// ── Tab bar buttons ───────────────────────────────────────────────────────────

function setupTabBarButtons() {
  document.getElementById('btn-new-tab').onclick        = () => createTab();
  document.getElementById('btn-split').onclick          = () => splitActivePane();
  document.getElementById('btn-split-h').onclick        = () => splitActivePane('horizontal');
  document.getElementById('btn-split-v').onclick        = () => splitActivePane('vertical');
  document.getElementById('btn-save-profile').onclick   = saveCurrentAsProfile;
  document.getElementById('btn-toggle-sidebar').onclick = toggleSidebar;
  document.getElementById('btn-toggle-history').onclick = toggleHistory;
  document.getElementById('btn-lang').onclick           = () => {
    cycleLang();
    renderTabBar();
    renderProfiles();
    renderHistory();
  };
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

async function createTab(label = null, cwdOverride = null) {
  const tabId = newTabId();
  const tab = {
    id: tabId,
    label: label || `${t('tab.defaultName')} ${tabs.length + 1}`,
    panes: [],
    splitMode: null,
    splitInstance: null,
  };
  tabs.push(tab);
  activeTabId = tabId;

  renderTabBar();

  const cwd = cwdOverride || 'C:\\';
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
  if (tab && tab.panes.length > 0) {
    setActivePane(tab.panes[0]);
  }
}

function closeActiveTab() {
  if (tabs.length <= 1) return;
  const tabId = activeTabId;
  const tab = getTab(tabId);
  if (!tab) return;

  tab.panes.forEach(paneId => destroyPane(paneId));

  const area = document.querySelector(`[data-tab-area="${tabId}"]`);
  if (area) area.remove();

  tabs = tabs.filter(t => t.id !== tabId);

  if (tabs.length > 0) {
    activateTab(tabs[tabs.length - 1].id);
  }
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
      input.focus();
      input.select();

      const commit = () => {
        tab.label = input.value.trim() || tab.label;
        input.replaceWith(label);
        label.textContent = tab.label;
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') input.blur();
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
      if (tObj) tObj.panes.forEach(paneId => destroyPane(paneId));
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

async function addPane(tabId, cwd) {
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

  let area = document.querySelector(`[data-tab-area="${tabId}"]`);
  if (!area) {
    area = document.createElement('div');
    area.className = 'pane-wrapper';
    area.dataset.tabArea = tabId;
    area.style.display = 'flex';
    document.getElementById('terminal-area').appendChild(area);
  }
  area.appendChild(paneEl);

  document.querySelectorAll('[data-tab-area]').forEach(el => {
    el.style.display = el.dataset.tabArea === activeTabId ? 'flex' : 'none';
  });

  const term = new Terminal({
    theme: {
      background:   '#0d0d1a',
      foreground:   '#e0e0f0',
      cursor:       '#7c6af7',
      cursorAccent: '#0d0d1a',
      selectionBackground: 'rgba(124,106,247,0.3)',
      black:   '#1a1a2e', red:     '#e05c6a',
      green:   '#56cfbc', yellow:  '#f5c542',
      blue:    '#7c6af7', magenta: '#c56af5',
      cyan:    '#56cfbc', white:   '#e0e0f0',
      brightBlack:   '#44445a', brightRed:     '#ff7b85',
      brightGreen:   '#7dffd3', brightYellow:  '#ffd27d',
      brightBlue:    '#a08fff', brightMagenta: '#e08fff',
      brightCyan:    '#7dffd3', brightWhite:   '#ffffff',
    },
    fontFamily: "'Cascadia Code', 'Cascadia Mono', 'Consolas', monospace",
    fontSize: 13,
    lineHeight: 1.35,
    scrollback: 5000,
    allowProposedApi: true,
    cursorBlink: true,
    cursorStyle: 'bar',
    windowsMode: true,
    macOptionIsMeta: false,
    rightClickSelectsWord: false,
  });

  const fitAddon = new FitAddon.FitAddon();
  const linksAddon = new WebLinksAddon.WebLinksAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(linksAddon);
  term.open(xtermContainer);

  // Ctrl+Shift+C → copy, Ctrl+Shift+V → paste
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

  // Right-click: copy if selection, paste if not
  xtermContainer.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const sel = term.getSelection();
    if (sel) {
      await navigator.clipboard.writeText(sel);
      term.clearSelection();
    } else {
      const text = await navigator.clipboard.readText().catch(() => '');
      if (text) api.ptyWrite({ id: ptyId, data: text });
    }
  });

  // Intercept typed commands for history
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

  const result = await api.ptyCreate({ id: ptyId, cwd });
  if (!result.success) {
    term.write(`\x1b[31m${t('term.error')} ${result.error}\x1b[0m\r\n`);
  }

  requestAnimationFrame(() => {
    try {
      fitAddon.fit();
      const { cols, rows } = term;
      api.ptyResize({ id: ptyId, cols, rows });
    } catch (_) {}
  });

  setActivePane(paneId);

  const ro = new ResizeObserver(() => {
    try {
      fitAddon.fit();
      const { cols, rows } = term;
      api.ptyResize({ id: ptyId, cols, rows });
    } catch (_) {}
  });
  ro.observe(paneEl);

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

  rebuildTabLayout(tabId);

  if (activePaneId === paneId && tab.panes.length > 0) {
    setActivePane(tab.panes[0]);
  }
}

// ── Split panes ───────────────────────────────────────────────────────────────

function autoDetectSplitDirection() {
  const pane = panes[activePaneId];
  if (!pane) return 'horizontal';
  const { width, height } = pane.el.getBoundingClientRect();
  return width >= height ? 'horizontal' : 'vertical';
}

async function splitActivePane(direction = null) {
  if (!activePaneId || !activeTabId) return;
  const tab = getTab(activeTabId);
  if (!tab) return;

  const resolvedDir = direction || autoDetectSplitDirection();
  const activePanePath = panes[activePaneId]?.path || 'C:\\';
  await addPane(activeTabId, activePanePath);

  tab.splitMode = resolvedDir;
  rebuildTabLayout(activeTabId);
}

function rebuildTabLayout(tabId) {
  const tab = getTab(tabId);
  if (!tab) return;

  const area = document.querySelector(`[data-tab-area="${tabId}"]`);
  if (!area) return;

  area.style.flexDirection = tab.splitMode === 'vertical' ? 'column' : 'row';

  tab.panes.forEach(paneId => {
    const pane = panes[paneId];
    if (pane) area.appendChild(pane.el);
  });

  if (tab.splitInstance) {
    try { tab.splitInstance.destroy(); } catch (_) {}
    tab.splitInstance = null;
  }

  if (tab.panes.length > 1) {
    const elements = tab.panes.map(id => panes[id]?.el).filter(Boolean);
    const sizes = elements.map(() => 100 / elements.length);

    tab.splitInstance = Split(elements, {
      direction: tab.splitMode === 'vertical' ? 'vertical' : 'horizontal',
      sizes,
      minSize: 100,
      gutterSize: 4,
      onDragEnd: () => {
        tab.panes.forEach(id => {
          const p = panes[id];
          if (p) {
            try {
              p.fitAddon.fit();
              api.ptyResize({ id: p.ptyId, cols: p.term.cols, rows: p.term.rows });
            } catch (_) {}
          }
        });
      },
    });
  }

  requestAnimationFrame(() => {
    tab.panes.forEach(id => {
      const p = panes[id];
      if (p) {
        try {
          p.fitAddon.fit();
          api.ptyResize({ id: p.ptyId, cols: p.term.cols, rows: p.term.rows });
        } catch (_) {}
      }
    });
  });
}

// ── History ───────────────────────────────────────────────────────────────────

function addToHistory(cmd, tabLabel) {
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  commandHistory.unshift({ time, tabLabel, cmd });
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const filter = document.getElementById('history-search').value.toLowerCase();
  list.innerHTML = '';
  commandHistory.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'history-item' + (filter && !item.cmd.toLowerCase().includes(filter) ? ' hidden' : '');
    li.title = t('history.rerun');

    const time = document.createElement('span');
    time.className = 'hi-time';
    time.textContent = item.time;

    const tabEl = document.createElement('span');
    tabEl.className = 'hi-tab';
    tabEl.textContent = item.tabLabel;

    const cmd = document.createElement('span');
    cmd.className = 'hi-cmd';
    cmd.textContent = item.cmd;

    li.appendChild(time);
    li.appendChild(tabEl);
    li.appendChild(cmd);

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
    renderHistory();
  };
  document.getElementById('btn-close-history').onclick = toggleHistory;
}

function toggleHistory() {
  document.getElementById('history-panel').classList.toggle('collapsed');
  setTimeout(() => {
    Object.values(panes).forEach(p => {
      try {
        p.fitAddon.fit();
        api.ptyResize({ id: p.ptyId, cols: p.term.cols, rows: p.term.rows });
      } catch (_) {}
    });
  }, 220);
}

// ── Profiles ──────────────────────────────────────────────────────────────────

function setupSidebarUI() {
  document.getElementById('btn-add-profile').onclick = saveCurrentAsProfile;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  setTimeout(() => {
    Object.values(panes).forEach(p => {
      try {
        p.fitAddon.fit();
        api.ptyResize({ id: p.ptyId, cols: p.term.cols, rows: p.term.rows });
      } catch (_) {}
    });
  }, 220);
}

async function saveCurrentAsProfile() {
  const name = prompt(t('sidebar.profileName'));
  if (!name) return;

  const snapshot = tabs.map(tab => ({
    label: tab.label,
    panes: tab.panes.map(paneId => ({
      path: panes[paneId]?.path || 'C:\\',
    })),
  }));

  profiles.push({ name, tabs: snapshot, created: new Date().toISOString() });
  await api.saveProfiles(profiles);
  renderProfiles();
}

async function loadProfile(profile) {
  while (tabs.length > 1) {
    const last = tabs[tabs.length - 1];
    last.panes.forEach(paneId => destroyPane(paneId));
    const area = document.querySelector(`[data-tab-area="${last.id}"]`);
    if (area) area.remove();
    tabs.pop();
  }
  if (tabs.length === 1) {
    const tObj = tabs[0];
    tObj.panes.forEach(paneId => destroyPane(paneId));
    const area = document.querySelector(`[data-tab-area="${tObj.id}"]`);
    if (area) area.innerHTML = '';
    tObj.panes = [];
    tObj.label = profile.tabs[0]?.label || `${t('tab.defaultName')} 1`;
  }

  for (let i = 0; i < profile.tabs.length; i++) {
    const snap = profile.tabs[i];
    let tabId;
    if (i === 0 && tabs.length === 1) {
      tabId = tabs[0].id;
      tabs[0].label = snap.label;
      activeTabId = tabId;
      for (const paneSnap of snap.panes) {
        await addPane(tabId, paneSnap.path);
      }
      if (snap.panes.length > 1) {
        getTab(tabId).splitMode = 'horizontal';
        rebuildTabLayout(tabId);
      }
    } else {
      tabId = await createTab(snap.label, snap.panes[0]?.path);
      for (let j = 1; j < snap.panes.length; j++) {
        await addPane(tabId, snap.panes[j].path);
      }
      if (snap.panes.length > 1) {
        getTab(tabId).splitMode = 'horizontal';
        rebuildTabLayout(tabId);
      }
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

    li.appendChild(name);
    li.appendChild(tabCount);
    li.appendChild(delBtn);
    li.onclick = () => loadProfile(profile);
    list.appendChild(li);
  });
}
