# Tasks: Pomodoro Timer Plugin

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 575–585 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-always |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Build configs + types foundation | PR 1 | ~125 lines, base: main — independently verifiable via npm install + tsc check |
| 2 | Timer engine + settings tab | PR 2 | ~195 lines, base: PR 1 — engine testable with fake Plugin; settings show in Obsidian |
| 3 | View + entry point + styles + config | PR 3 | ~260 lines, base: PR 2 — full integration, end-to-end verifiable |

## Phase 1: Scaffold

- [x] 1.1 Create `pomodoro-timer/` build config files: `manifest.json` (id `"pomodoro-timer"`), `package.json` (devDeps: `obsidian`, `typescript`, `esbuild`, `tslib`, `@types/node`), `tsconfig.json` (ES2018 target, commonjs, strict), `esbuild.config.mjs` (entry `pomodoro-timer/main.ts`, external `["obsidian"]`, cjs), `versions.json`, `.gitignore` (ignore `node_modules/` and `main.js`)
- [x] 1.2 Run `npm install` in `pomodoro-timer/` and verify zero errors
- [x] 1.3 Create `pomodoro-timer/src/types.ts`: `TimerPhase` enum (FOCUS, BREAK, LONG_BREAK), `PomodoroSettings` interface, `TimerState` interface, `DEFAULT_SETTINGS` constant per design contracts

## Phase 2: Timer Engine

- [x] 2.1 Create `pomodoro-timer/src/timer.ts` — `TimerEngine` class: constructor accepts `Plugin` + `PomodoroSettings`; exposes `onStateChange(cb)`, `removeListener(cb)`, `start()`, `pause()`, `reset()`, `destroy()` per design interface
- [x] 2.2 Implement state machine transitions: IDLE→WORKING→BREAK→LONG_BREAK per spec transition table (timer-engine R1); cycle counter increments on phase completion (R3); reset clears to IDLE with cycle=0
- [x] 2.3 Implement drift-corrected tick via `Date.now()` delta each callback (timer-engine R2); use plugin's `registerInterval()` — zero bare `setInterval`

## Phase 3: Settings + UI

- [x] 3.1 Create `pomodoro-timer/src/settings.ts` — `PomodoroSettingTab extends PluginSettingTab`: number inputs for work/break/longBreak durations, cycles before long break (timer-settings R1, R2); CRT glow toggle (R4); clamp minimums to 1; `loadData()` fallback to `DEFAULT_SETTINGS` on first run (R3)
- [x] 3.2 Create `pomodoro-timer/src/view.ts` — `PomodoroView extends ItemView`: `getViewType()` returns `"pomodoro-timer-view"`, `getDisplayText()` returns `"Pomodoro Timer"`, `getIcon()` returns `"timer"` (terminal-ui R1); build DOM via `createEl()`/`createDiv()` only — zero `innerHTML` (R3); ASCII box-drawing borders, `$ start`/`$ stop`/`$ reset` prompt buttons, timer display, progress bar, status line
- [x] 3.3 Subscribe view to `TimerEngine.onStateChange`; re-render on tick; handle start/pause/reset button clicks; cleanup subscription on `onClose()`
- [x] 3.4 Create `pomodoro-timer/styles.css`: `font-family: var(--font-monospace)` (terminal-ui R2); colors via Obsidian CSS variables only — `--background-primary`, `--text-normal`, `--text-accent`, `--interactive-accent`; `.crt-glow` class with `text-shadow` for progressive enhancement (R2 scenarios)

## Phase 4: Integration

- [x] 4.1 Create `pomodoro-timer/main.ts` — Plugin class: `onload()` instantiates `TimerEngine` with loaded settings, registers view via `registerView()`, adds 3 commands, adds `PomodoroSettingTab` (plugin-lifecycle R1, R3)
- [x] 4.2 Wire commands: `open-pomodoro` (activates right sidebar), `start-pomodoro` (starts engine if idle), `stop-pomodoro` (resets engine); no default hotkeys (plugin-lifecycle R2)
- [x] 4.3 Update `openspec/config.yaml` context line to mention pomodoro-timer plugin

## Phase 5: Verification

- [x] 5.1 Run `tsc --noEmit` in `pomodoro-timer/` — zero errors required
- [x] 5.2 Run `npm run build` in `pomodoro-timer/` — produces `pomodoro-timer/main.js` without errors; verify output does not collide with root `main.js`
- [x] 5.3 Manual: sidebar opens via command palette; timer UI renders with terminal aesthetic; start/stop/reset controls function (terminal-ui R1, plugin-lifecycle R2 scenarios)
- [x] 5.4 Manual: timer cycles Focus → Break → Long Break per configured durations; cycle counter increments correctly (timer-engine R1, R3 scenarios)
- [x] 5.5 Manual: settings persist across plugin reload (timer-settings R3 scenario); dark and light themes render correctly via CSS variables (terminal-ui R2 scenarios)
- [x] 5.6 Code review: verify zero `innerHTML`, zero bare `setInterval`, zero global `app` access
