# ConsoleSplit

A multi-terminal desktop application with tabs and split panes. Open multiple consoles in different directories, all inside a single window.

---

## Features

- **Multiple tabs** — each with its own independent terminal session
- **Split panes** — split any panel horizontally or vertically
- **Real terminal** — powered by `node-pty` + `xterm.js` for native PTY emulation
- **Route profiles** — save and restore groups of terminals with one click
- **Global history** — panel showing all commands run across all terminals
- **Dark theme** — minimal UI with custom colors
- **Frameless window** — custom title bar with drag support
- **Windows native** — optimized for Windows 11

---

## Installation

### Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- [Python](https://www.python.org/) (required by `node-gyp` to compile `node-pty`)
- **Visual Studio Build Tools** with "Desktop development with C++" workload
  - Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/

### Steps

Open **PowerShell or CMD on Windows** (not WSL):

```bash
# Clone the repository
git clone https://github.com/Fabririguetto/ConsoleSplit.git
cd ConsoleSplit

# Install dependencies (compiles node-pty natively)
npm install

# If node-pty fails to compile, rebuild for Electron:
npm run rebuild
```

> **Important:** `node-pty` requires native compilation. Always run from a real
> Windows terminal (PowerShell/CMD), never from WSL or Git Bash.

---

## Usage

```bash
npm start
```

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New tab | `Ctrl + T` |
| Close active tab | `Ctrl + W` |
| Split panel (horizontal) | `Ctrl + Shift + H` |
| Split panel (vertical) | `Ctrl + Shift + V` |

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ⬡ ConsoleSplit                                    ─  □  ✕       │
├──────────────────────────────────────────────────────────────────┤
│ [● Terminal 1] [● Terminal 2] [+]    ⬛▌  ⬛▀  ☰  ⏱            │
├──────────────────────────────────────────────────────────────────┤
│ Profiles │ 📁 C:\projects\api>        │ 📁 C:\projects\web>      │
│          │                           │                           │
│ API      │  PS C:\projects\api>      │  PS C:\projects\web>     │
│ Frontend │  npm run dev              │  npm install              │
│ Database │  _                        │  _                        │
├──────────┴───────────────────────────┴──────────────────────────┤
│ ⏱ History  [Filter commands...]                         🗑  ✕   │
│ 14:32  Terminal 1  npm run dev                                    │
│ 14:30  Terminal 2  npm install                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
ConsoleSplit/
├── main.js          # Electron main process + node-pty management
├── preload.js       # Secure IPC bridge (contextIsolation)
├── src/
│   ├── index.html   # Main UI
│   ├── renderer.js  # Tabs, splits, profiles and history logic
│   └── styles.css   # Custom dark theme
└── package.json
```

---

## Build as .exe

```bash
npm run pack
```

The executable will be generated in the `dist/` folder.

---

## Tech Stack

| Technology | Role |
|------------|------|
| [Electron](https://electronjs.org/) | Native window framework |
| [node-pty](https://github.com/microsoft/node-pty) | Real PTY emulation |
| [xterm.js](https://xtermjs.org/) | Terminal rendering in HTML |
| [xterm-addon-fit](https://github.com/xtermjs/xterm.js) | Auto-resize terminal |
| [Split.js](https://split.js.org/) | Resizable split panels |

---

## License

MIT
