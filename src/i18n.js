/* ── ConsoleSplit i18n ───────────────────────────────────────────────────── */

const TRANSLATIONS = {
  es: {
    'win.minimize':          'Minimizar',
    'win.maximize':          'Maximizar',
    'win.close':             'Cerrar',
    'sidebar.title':         'Perfiles',
    'sidebar.add':           'Guardar diseño actual',
    'sidebar.empty':         'Sin perfiles guardados',
    'sidebar.profileName':   'Nombre del perfil:',
    'sidebar.delete':        'Eliminar perfil',
    'tab.new':               'Nueva pestaña (Ctrl+T)',
    'tab.close':             'Cerrar pestaña',
    'tab.defaultName':       'Terminal',
    'btn.split':             'Dividir panel (auto)',
    'btn.splitH':            'Dividir horizontal (Ctrl+Shift+H)',
    'btn.splitV':            'Dividir vertical (Ctrl+Shift+V)',
    'btn.sidebar':           'Perfiles',
    'btn.saveProfile':       'Guardar perfil (Ctrl+Shift+S)',
    'btn.history':           'Historial global',
    'history.title':         'Historial de comandos',
    'history.filter':        'Filtrar comandos...',
    'history.clear':         'Limpiar historial',
    'history.close':         'Cerrar',
    'history.rerun':         'Click para re-ejecutar en terminal activa',
    'pane.changeDir':        'Cambiar directorio',
    'pane.close':            'Cerrar panel',
    'term.exit':             '[Proceso terminado]',
    'term.error':            'Error al crear terminal:',
  },
  en: {
    'win.minimize':          'Minimize',
    'win.maximize':          'Maximize',
    'win.close':             'Close',
    'sidebar.title':         'Profiles',
    'sidebar.add':           'Save current layout',
    'sidebar.empty':         'No saved profiles',
    'sidebar.profileName':   'Profile name:',
    'sidebar.delete':        'Delete profile',
    'tab.new':               'New tab (Ctrl+T)',
    'tab.close':             'Close tab',
    'tab.defaultName':       'Terminal',
    'btn.split':             'Split panel (auto)',
    'btn.splitH':            'Split horizontal (Ctrl+Shift+H)',
    'btn.splitV':            'Split vertical (Ctrl+Shift+V)',
    'btn.sidebar':           'Profiles',
    'btn.saveProfile':       'Save profile (Ctrl+Shift+S)',
    'btn.history':           'Global history',
    'history.title':         'Command history',
    'history.filter':        'Filter commands...',
    'history.clear':         'Clear history',
    'history.close':         'Close',
    'history.rerun':         'Click to re-run in active terminal',
    'pane.changeDir':        'Change directory',
    'pane.close':            'Close panel',
    'term.exit':             '[Process terminated]',
    'term.error':            'Failed to create terminal:',
  },
};

const LANG_LABELS = { es: 'ES', en: 'EN' };
const LANGS = Object.keys(TRANSLATIONS);

function detectLang() {
  const saved = localStorage.getItem('consolesplit-lang');
  if (saved && LANGS.includes(saved)) return saved;
  const sys = (navigator.language || 'en').toLowerCase().split('-')[0];
  return LANGS.includes(sys) ? sys : 'en';
}

let currentLang = detectLang();

function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS['en'][key] ?? key;
}

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem('consolesplit-lang', lang);
  document.documentElement.lang = currentLang;
  applyTranslations();
}

function cycleLang() {
  const next = LANGS[(LANGS.indexOf(currentLang) + 1) % LANGS.length];
  setLang(next);
  // Update language button label
  const btn = document.getElementById('btn-lang');
  if (btn) btn.textContent = LANG_LABELS[currentLang];
}

function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  // Update language button label
  const btn = document.getElementById('btn-lang');
  if (btn) btn.textContent = LANG_LABELS[currentLang];
}
