# Exploration: Pomodoro Timer with Terminal/CLI Aesthetic

## Current State

### Project Organization

The repository is a **single Obsidian plugin** (cloudimage-uploader) at repository root, using the standard Obsidian plugin structure:

```
/Users/maikol/Desktop/newProyect/
├── main.ts                  # Plugin entry point (extends Plugin)
├── manifest.json            # Plugin metadata (id, name, version, minAppVersion)
├── styles.css               # Plugin CSS (uses Obsidian CSS variables)
├── esbuild.config.mjs       # Bundler: entryPoints ["main.ts"], cjs, external ["obsidian"]
├── package.json             # Node deps: esbuild 0.24, typescript 5.4, obsidian 1.7
├── tsconfig.json            # TypeScript strict mode, ES2020, path alias "src/*"
├── versions.json            # Obsidian plugin version compatibility map
└── src/
    ├── types.ts             # Interfaces, DEFAULT_SETTINGS, type aliases
    ├── settings.ts          # PluginSettingTab subclass
    ├── modal.ts             # Modal subclass (upload UI)
    ├── api.ts               # ImgBBClient static class (fetch-based API)
    └── editor.ts            # EditorService static class (cursor insertion)
```

### Plugin Lifecycle Pattern (`main.ts`)

```typescript
export default class CloudImagePlugin extends Plugin {
  settings!: CloudImagePluginSettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new CloudImageSettingTab(this.app, this));
    this.addCommand({ id, name, hotkeys, callback });
  }
}
```

Key patterns:
- No `onunload()` — cleanup is handled by Obsidian's `Component` base class auto-detaching registered resources.
- `loadData()` / `saveData()` persist to `data.json` in the plugin's Obsidian folder.
- Default settings spread: `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())`.

### Existing CSS Variable Usage (`styles.css`)

The plugin exclusively uses Obsidian theme variables — never hardcoded colors:

| CSS Variable | Usage |
|---|---|
| `--text-muted` | Secondary text, placeholder borders |
| `--text-normal` | Primary text on inputs |
| `--text-faint` | Placeholder text, empty states |
| `--interactive-accent` | Active/highlight borders |
| `--interactive-normal` | Button backgrounds |
| `--interactive-hover` | Button hover states |
| `--background-primary` | Input backgrounds |
| `--background-modifier-hover` | Hover backgrounds |
| `--background-modifier-border` | Borders, separators |

### Settings Tab Pattern (`src/settings.ts`)

```typescript
export class CloudImageSettingTab extends PluginSettingTab {
  plugin: CloudImagePlugin;
  constructor(app: App, plugin: CloudImagePlugin) { super(app, plugin); }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("...").setDesc("...")
      .addText(text => text.setPlaceholder("...").setValue(...).onChange(async (value) => {
        this.plugin.settings.apiKey = value;
        await this.plugin.saveData(this.plugin.settings);
      }));
  }
}
```

### Timer / Interval Patterns

**No existing timer or interval usage in the codebase.** Obsidian's `Component` base class provides:
- `registerInterval(id: number)` — registers a `window.setInterval` ID to be auto-cleared on plugin unload.
- `registerDomEvent(el, type, callback)` — registers DOM listeners auto-detached on unload.
- **Rule**: Use `window.setInterval` (not `setInterval`) to avoid TypeScript confusion with Node.js types.

### ItemView API

**Not used in this codebase.** The Obsidian SDK provides:

```typescript
// plugin.ts — registration
plugin.registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => View): void;

// workspace — finding/creating leaves
workspace.getLeavesOfType(viewType: string): WorkspaceLeaf[];
workspace.getRightLeaf(false): WorkspaceLeaf | null;  // right sidebar
workspace.revealLeaf(leaf: WorkspaceLeaf): Promise<void>;

// ItemView subclass
abstract class ItemView extends View {
  contentEl: HTMLElement;
  constructor(leaf: WorkspaceLeaf);
  addAction(icon: IconName, title: string, callback): HTMLElement;
}

// View methods to override
abstract getViewType(): string;
abstract getDisplayText(): string;
getIcon(): IconName;           // defaults to empty string
navigation: boolean;           // false for static views
protected onOpen(): Promise<void>;
protected onClose(): Promise<void>;
```

### Monospace CSS Variables

Obsidian defines `--font-monospace` (for code blocks) and `--font-monospace-theme` as theme-accessible CSS custom properties. These are **not in the TypeScript type definitions** — they are DOM-level CSS variables set by Obsidian themes. They can be read via:

```typescript
getComputedStyle(document.body).getPropertyValue('--font-monospace')
```

Or used directly in CSS:
```css
.pomodoro-terminal {
  font-family: var(--font-monospace);
}
```

## Affected Areas

Since this is a **greenfield plugin** that lives alongside the existing cloudimage-uploader, the affected areas fall into two categories:

### New Plugin Files (new directory)

| Path | Purpose |
|---|---|
| `pomodoro-timer/manifest.json` | Plugin metadata (`id: "pomodoro-timer"`) |
| `pomodoro-timer/main.ts` | Plugin entry: register View + Command + SettingTab |
| `pomodoro-timer/src/types.ts` | PomodoroTimerSettings, TimerState types |
| `pomodoro-timer/src/settings.ts` | PomodoroSettingTab (duration configs) |
| `pomodoro-timer/src/view.ts` | PomodoroView extends ItemView (right sidebar) |
| `pomodoro-timer/src/timer.ts` | TimerEngine: state machine (work→break→long break) |
| `pomodoro-timer/styles.css` | Terminal-themed CSS |
| `pomodoro-timer/esbuild.config.mjs` | Bundler config (same pattern, different entryPoint) |
| `pomodoro-timer/package.json` | Dependencies (same versions as parent) |
| `pomodoro-timer/tsconfig.json` | TypeScript config (extends parent patterns) |
| `pomodoro-timer/versions.json` | Obsidian version compatibility |

### Repository-Level Changes

| Path | Change |
|---|---|
| `openspec/config.yaml` | Update context to mention pomodoro-timer plugin |
| `.gitignore` | Already ignores `.obsidian/` — no change needed |

### No Changes To

- `main.ts` (cloudimage-uploader) — untouched
- `src/` (cloudimage-uploader) — untouched
- `styles.css` (cloudimage-uploader) — untouched
- `esbuild.config.mjs` (cloudimage-uploader) — untouched

## Approaches — Terminal UI

### Approach 1: Pure ASCII with Unicode Box-Drawing Characters

Render the timer display using Unicode box-drawing characters inside a `<pre>` element with `--font-monospace`.

```typescript
// Example rendered string in contentEl
const display = `
╭──────────────╮
│  25:00       │
│  ████████░░  │
│  Work        │
│  3/4 cycles  │
╰──────────────╯
`;
```

**Implementation**: Build the ASCII art strings in TypeScript, render into a single `<pre>` or `<div>` element. Refresh on timer tick by replacing `.textContent`.

- **Pros**: No complex CSS needed. Pure text. Works in every theme. Fits the CLI aesthetic literally. Simple code.
- **Cons**: No interactive elements (buttons can't live inside `<pre>`). Updating individual parts requires full string rebuild. Limited visual flair. No animations/transitions.
- **Effort**: Low

### Approach 2: CSS-Simulated Terminal with HTML Elements

Build the UI as structured HTML elements styled to look like a terminal.

```html
<div class="pomodoro-terminal">
  <div class="pomodoro-header">┌── Pomodoro ──────────────┐</div>
  <div class="pomodoro-timer">25:00</div>
  <div class="pomodoro-progress">████████░░</div>
  <div class="pomodoro-status">WORK · Cycle 3/4</div>
  <div class="pomodoro-controls">
    <button>▶ start</button>
    <button>■ stop</button>
    <button>↺ reset</button>
  </div>
</div>
```

```css
.pomodoro-terminal {
  font-family: var(--font-monospace);
  background: var(--background-primary);
  color: var(--text-normal);
  padding: 12px;
  border-radius: 4px;
  /* Optional: CRT glow */
  text-shadow: 0 0 2px var(--text-accent);
  box-shadow: inset 0 0 30px rgba(0, 255, 0, 0.05);
}
```

- **Pros**: Full interactivity (buttons). CSS transitions for timer pulse, progress bar animations. Accessible (real elements). Can mix ASCII borders with HTML buttons. Easy to theme — respect Obsidian dark/light via CSS variables.
- **Cons**: More CSS to write. Terminal borders need to account for varying monospace widths across themes. Glow effects might look bad in some themes.
- **Effort**: Medium

### Approach 3: Canvas-based Terminal Emulator

Use `<canvas>` to render a full terminal emulator with xterm.js-like behavior.

- **Pros**: Complete control over rendering. True scanline/CRT effects. Could support typing commands.
- **Cons**: **Way over-engineered** for a timer. Canvas blocks accessibility. Requires complex rendering logic. Dependency on canvas API.
- **Effort**: High

## Recommendation

**Approach 2: CSS-Simulated Terminal with HTML Elements**

This hits the sweet spot: it looks like a terminal, feels interactive, respects Obsidian themes, and is accessible. Specifically:

1. **Structure**: Use `<div>` with `font-family: var(--font-monospace)` as the terminal container. Box-drawing characters for static borders (header/footer). HTML buttons styled as CLI prompts for controls.

2. **Timer Display**: Large monospace digits (`25:00`) with `text-shadow` for subtle CRT glow. Progress bar as ASCII blocks (▌ ▌ ▌) or a CSS bar with monospace-character-width segments.

3. **Button Styling**: Buttons styled like shell prompts — `$ start`, `$ stop`, `$ reset` — with green/accent color. Minimal button chrome (no rounded borders, flat appearance).

4. **Theme Respect**: Use Obsidian CSS variables exclusively:
   - `--font-monospace` for the typeface
   - `--background-secondary` or `--background-primary` for the terminal "screen"
   - `--text-normal` for main text
   - `--text-accent` for the prompt `$`
   - `--interactive-accent` for button hover glow
   - CRT glow via `text-shadow` with low-opacity `--text-accent`

5. **Progressive Enhancement**: 
   - **Minimum viable**: Monospace digits + ASCII borders + HTML buttons. No glow.
   - **Enhanced**: Add `text-shadow` glow and `box-shadow` inset for CRT effect when `--text-accent` has good contrast.
   - **Themed**: User can toggle glow/no-glow in settings.

### Recommended File Structure

```
pomodoro-timer/
├── manifest.json           # Plugin metadata
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── esbuild.config.mjs      # Bundler
├── versions.json           # Obsidian version map
├── main.ts                 # Plugin entry: registerView + addCommand + addSettingTab
├── styles.css              # Terminal UI CSS
└── src/
    ├── types.ts            # PomodoroSettings, TimerPhase, TimerState
    ├── settings.ts         # PomodoroSettingTab
    ├── view.ts             # PomodoroView extends ItemView
    └── timer.ts            # TimerEngine (state machine, registerInterval)
```

### Architecture

```
main.ts (Plugin)
  ├── registerView("pomodoro-timer", PomodoroView)
  ├── addCommand("start-pomodoro") → activates sidebar
  └── addSettingTab(PomodoroSettingTab)

view.ts (ItemView)
  ├── onOpen() → build DOM (CSS terminal)
  ├── timer.ts → TimerEngine (registerInterval every 1000ms)
  └── onClose() → stop timer, cleanup

timer.ts (TimerEngine)
  ├── State machine: IDLE → WORKING → BREAK → LONG_BREAK
  ├── Uses window.setInterval + plugin.registerInterval
  └── Emits state changes → view re-renders display

types.ts
  ├── PomodoroSettings { workDuration, breakDuration, longBreakDuration, cyclesBeforeLongBreak, enableGlow }
  └── TimerState { phase, remaining, cycle, totalCycles }
```

## Risks

1. **Right Sidebar Competition**: Users may already have plugins occupying the right sidebar (calendar, backlinks, outline). The Pomodoro view will need to coexist. Mitigation: also provide a command to open as a modal popup.

2. **setInterval Accuracy**: `setInterval` can drift, especially when the browser tab is backgrounded. For a Pomodoro timer sub-second precision isn't critical, but the display should sync to `Date.now()` on each tick rather than relying solely on interval counting.

3. **No Test Infrastructure**: The codebase has no test runner, no test files, and `openspec/config.yaml` confirms `testing.runner: null`. Setting up Jest or Vitest for the timer state machine would add complexity. Recommendation: start without tests, add testing infrastructure as a separate change if warranted.

4. **Monospace Font Variance Across Themes**: Different Obsidian themes set `--font-monospace` to different fonts (JetBrains Mono, Fira Code, Consolas, etc.) with different character widths. Box-drawing Unicode characters may misalign. Solution: use CSS `border` + `padding` for the frame instead of relying on character-level alignment, or test with 3-4 popular themes.

5. **Plugin Isolation in Same Repo**: Two plugins sharing a repo root means they must not interfere with each other's build output (`main.js`). Each needs its own entry/output. The pomodoro-timer esbuild config must output to `pomodoro-timer/main.js`, not the root `main.js`. Verify no path collisions.

## Ready for Proposal

**Yes** — the codebase is well-understood, the Obsidian APIs needed (ItemView, registerInterval, PluginSettingTab, addCommand) are all available in the SDK v1.7, and the approach is clear. Proceed to `sdd-propose`.
