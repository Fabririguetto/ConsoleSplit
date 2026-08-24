# ConsoleSplit

> **[Español](#español) | [English](#english)**

---

<a name="español"></a>
# Español

Aplicacion de escritorio multi-terminal con pestanas y paneles divididos. Permite abrir multiples consolas en diferentes rutas, todo en una sola ventana.

## Caracteristicas

- **Multiples pestanas** — cada una con su propia sesion de terminal
- **Split panes** — divide cualquier panel horizontal o verticalmente
- **Terminal real** — usa `node-pty` + `xterm.js` para emulacion PTY nativa
- **Perfiles de rutas** — guarda y restaura grupos de terminales con un click
- **Historial global** — panel con todos los comandos ejecutados en todas las consolas
- **Dark theme** — interfaz minimalista con colores personalizados
- **Sin bordes** — ventana frameless con barra de titulo propia
- **Windows nativo** — optimizado para Windows 11

## Instalacion

### Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- [Python](https://www.python.org/) (requerido por `node-gyp` para compilar `node-pty`)
- **Visual Studio Build Tools** con "Desarrollo de escritorio con C++" instalado
  - Descargar: https://visualstudio.microsoft.com/visual-cpp-build-tools/

### Pasos

Abrir **PowerShell o CMD en Windows** (no WSL):

```bash
# Clonar el repositorio
git clone https://github.com/Fabririguetto/ConsoleSplit.git
cd ConsoleSplit

# Instalar dependencias (compila node-pty nativamente)
npm install

# Si node-pty falla al compilar, recompilar para Electron:
npm run rebuild
```

> **Importante:** `node-pty` requiere compilacion nativa. Siempre ejecutar desde
> una terminal Windows real (PowerShell/CMD), nunca desde WSL o Git Bash.

## Uso

```bash
npm start
```

## Atajos de teclado

| Accion | Atajo |
|--------|-------|
| Nueva pestana | `Ctrl + T` |
| Cerrar pestana activa | `Ctrl + W` |
| Dividir panel (horizontal) | `Ctrl + Shift + H` |
| Dividir panel (vertical) | `Ctrl + Shift + V` |

## Interfaz

```
┌─────────────────────────────────────────────────────────────────┐
│ ⬡ ConsoleSplit                                    ─  □  ✕       │
├──────────────────────────────────────────────────────────────────┤
│ [● Terminal 1] [● Terminal 2] [+]    ⬛▌  ⬛▀  ☰  ⏱            │
├──────────────────────────────────────────────────────────────────┤
│ Perfiles │ 📁 C:\proyectos\api>       │ 📁 C:\proyectos\web>     │
│          │                           │                           │
│ API      │  PS C:\proyectos\api>     │  PS C:\proyectos\web>    │
│ Frontend │  npm run dev              │  npm install              │
│ Database │  _                        │  _                        │
├──────────┴───────────────────────────┴──────────────────────────┤
│ ⏱ Historial  [Filtrar...]                               🗑  ✕   │
│ 14:32  Terminal 1  npm run dev                                    │
│ 14:30  Terminal 2  npm install                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Estructura del proyecto

```
ConsoleSplit/
├── main.js          # Proceso principal de Electron + node-pty
├── preload.js       # Puente IPC seguro (contextIsolation)
├── src/
│   ├── index.html   # UI principal
│   ├── renderer.js  # Logica de tabs, splits, perfiles e historial
│   └── styles.css   # Dark theme personalizado
└── package.json
```

## Empaquetar como .exe

```bash
npm run pack
```

El ejecutable se genera en la carpeta `dist/`.

## Stack tecnologico

| Tecnologia | Rol |
|------------|-----|
| [Electron](https://electronjs.org/) | Framework de ventana nativa |
| [node-pty](https://github.com/microsoft/node-pty) | Pseudoterminal real (PTY) |
| [xterm.js](https://xtermjs.org/) | Render del terminal en HTML |
| [xterm-addon-fit](https://github.com/xtermjs/xterm.js) | Ajuste automatico de tamanio |
| [Split.js](https://split.js.org/) | Paneles redimensionables |

## Licencia

MIT

---

<a name="english"></a>
# English

A multi-terminal desktop application with tabs and split panes. Open multiple consoles in different directories, all inside a single window.

## Features

- **Multiple tabs** — each with its own independent terminal session
- **Split panes** — split any panel horizontally or vertically
- **Real terminal** — powered by `node-pty` + `xterm.js` for native PTY emulation
- **Route profiles** — save and restore groups of terminals with one click
- **Global history** — panel showing all commands run across all terminals
- **Dark theme** — minimal UI with custom colors
- **Frameless window** — custom title bar with drag support
- **Windows native** — optimized for Windows 11

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

## Usage

```bash
npm start
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New tab | `Ctrl + T` |
| Close active tab | `Ctrl + W` |
| Split panel (horizontal) | `Ctrl + Shift + H` |
| Split panel (vertical) | `Ctrl + Shift + V` |

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

## Build as .exe

```bash
npm run pack
```

The executable will be generated in the `dist/` folder.

## Tech Stack

| Technology | Role |
|------------|------|
| [Electron](https://electronjs.org/) | Native window framework |
| [node-pty](https://github.com/microsoft/node-pty) | Real PTY emulation |
| [xterm.js](https://xtermjs.org/) | Terminal rendering in HTML |
| [xterm-addon-fit](https://github.com/xtermjs/xterm.js) | Auto-resize terminal |
| [Split.js](https://split.js.org/) | Resizable split panels |

## License

MIT
