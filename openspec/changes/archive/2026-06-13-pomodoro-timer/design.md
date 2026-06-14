# Design: Pomodoro Timer Plugin

## Technical Approach

Greenfield Obsidian plugin in `pomodoro-timer/` (sibling to `cloudimage-uploader/`). Standard scaffold: `manifest.json`, `main.ts`, `styles.css`, `package.json`, TypeScript tooling, and `src/`. The Plugin class owns the `TimerEngine` instance so it survives view close/reopen. `PomodoroView` (ItemView, right sidebar) renders terminal-aesthetic DOM. State machine drives phase transitions (FOCUS → BREAK → LONG_BREAK → FOCUS) with drift-corrected `setInterval`. Settings persisted via Obsidian's `loadData`/`saveData` API.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Timer ownership | `TimerEngine` lives in `Plugin` class | Singleton module, or owned by `PomodoroView` | View-owned timer dies on close. Module singleton couples to global. Plugin-owned survives view lifecycle — user can close sidebar while timer runs. |
| State management | Callback emitter on `TimerEngine` | Obsidian `addEventListener` on plugin, or a store class | Direct subscription via `onStateChange(fn)` is minimal. No need for external store — one producer, one consumer. |
| Timekeeping | `Date.now()` delta each tick | `setInterval` increment counter | Increment counting drifts ~15ms/tick. `Date.now()` delta is wall-clock accurate. |
| Terminal UI | CSS-simulated with border-box chars (`┌─┐`) | `<canvas>` terminal emulator, or plain HTML | CSS is responsive, respects Obsidian themes via CSS variables (`--font-monospace`, `--text-normal`). Canvas adds complexity without benefit. |
| Build tool | `esbuild` with `entryPoints: ["pomodoro-timer/main.ts"]` | Rollup, webpack, `tsc` only | Matches Obsidian sample plugin. Fast, zero-config, single output at `pomodoro-timer/main.js`. |

## Sequence Diagram: Timer Lifecycle

```
User        Plugin         TimerEngine     PomodoroView     setInterval
 │            │               │               │                │
 ├─open view─→│──registerView→│               │                │
 │            │               │──subscribe()──┤                │
 │            │               │               │──render(IDLE)  │
 │            │               │               │                │
 ├─start─────→│──startTimer()→│──start()      │                │
 │            │               │──────────────→│──render(RUNNING)│
 │            │               │               │                │──setInterval(1s)
 │            │               │               │                │──tick→│
 │            │               │←────tick──────│                │
 │            │               │──notify()─────→│──render(14:32) │
 │            │               │               │                │──tick→│
 │            │               │               │                │  ...  │
 │            │               │               │                │──tick→│
 │            │               │──phaseDone()──│                │
 │            │               │──notify()─────→│──render(BREAK) │
 │            │               │               │                │
 ├─close view┤               │──unsubscribe()│                │
 │            │               │               │  (timer still runs)
 │            │               │               │                │──tick→│
 │            │               │               │                │  ...  │
 │            │               │               │                │
 ├─open view─→│               │──subscribe()──┤                │
 │            │               │──notify()─────→│──render(04:02) │
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `pomodoro-timer/manifest.json` | Create | Plugin metadata (`id: "pomodoro-timer"`, `minAppVersion: "1.0.0"`) |
| `pomodoro-timer/main.ts` | Create | Plugin class: `onload` registers view, commands, settings tab; owns `TimerEngine` |
| `pomodoro-timer/styles.css` | Create | Terminal aesthetic: monospace, `--pomodoro-bg`, border-box chars for panel frames, cursor blink |
| `pomodoro-timer/src/view.ts` | Create | `PomodoroView extends ItemView`: subscribes to timer, renders terminal DOM, handles start/pause/reset clicks |
| `pomodoro-timer/src/timer.ts` | Create | `TimerEngine`: state machine, `registerInterval` via plugin, `Date.now()` drift correction, phase auto-transition |
| `pomodoro-timer/src/settings.ts` | Create | `PomodoroSettingTab extends PluginSettingTab`: focus/break/longBreak duration, longBreakInterval, notification toggle |
| `pomodoro-timer/src/types.ts` | Create | `PomodoroSettings`, `TimerPhase` enum (`FOCUS`, `BREAK`, `LONG_BREAK`), `TimerState` interface, defaults |
| `pomodoro-timer/package.json` | Create | `@types/node`, `obsidian` dev dep, `typescript`, `esbuild`, `tslib` |
| `pomodoro-timer/tsconfig.json` | Create | `target: "ES2018"`, `module: "commonjs"`, `lib: ["ES2018", "DOM"]` |
| `pomodoro-timer/esbuild.config.mjs` | Create | `entryPoints: ["pomodoro-timer/main.ts"]`, bundle, external: `["obsidian"]`, output: `pomodoro-timer/main.js` |
| `pomodoro-timer/versions.json` | Create | Obsidian version compatibility map |
| `pomodoro-timer/.gitignore` | Create | Ignore `node_modules/`, `main.js` (built artifact in plugin folder) |

## Interfaces / Contracts

```typescript
// src/types.ts
enum TimerPhase { FOCUS = "focus", BREAK = "break", LONG_BREAK = "long_break" }

interface PomodoroSettings {
  focusDuration: number;      // minutes, default 25
  breakDuration: number;      // minutes, default 5
  longBreakDuration: number;  // minutes, default 15
  longBreakInterval: number;  // sessions before long break, default 4
  autoStartBreaks: boolean;   // default false
  notifications: boolean;     // default true
}

interface TimerState {
  phase: TimerPhase;
  remainingSeconds: number;
  totalSeconds: number;
  status: "idle" | "running" | "paused";
  sessionsCompleted: number;
}

// TimerEngine public API (src/timer.ts)
type TimerCallback = (state: TimerState) => void;

class TimerEngine {
  constructor(plugin: Plugin, settings: PomodoroSettings);
  onStateChange(cb: TimerCallback): void;
  removeListener(cb: TimerCallback): void;
  start(): void;
  pause(): void;
  reset(): void;
  destroy(): void; // clears interval, removes listeners
}
```

`PomodoroView.getViewType()` returns `"pomodoro-timer-view"`. `getDisplayText()` returns `"Pomodoro Timer"`. `getIcon()` returns `"timer"` (lucide icon built into Obsidian).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `TimerEngine` state transitions, drift correction math, phase auto-switch | Jest + fake timers (`jest.useFakeTimers`), mock Plugin |
| Unit | Settings defaults and validation | Jest, pure functions |
| Integration | View renders timer state updates | Jest + jsdom, mock `obsidian` module |
| Manual | Terminal CSS renders correctly across Obsidian themes | Visual check in light/dark mode |
| Manual | Timer survives view close/reopen | Click flow in Obsidian dev vault |

## Open Questions

- [ ] Should the timer trigger an Obsidian `Notice` on phase completion, or rely on browser `Notification` API?
- [ ] Should completed sessions persist across plugin reloads (sessions count in data.json)?
