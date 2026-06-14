# Proposal: Pomodoro Timer Plugin

## Intent

Obsidian has no Pomodoro timer. Users practicing time-boxed focus break flow switching to external tools. This plugin provides standard cycles with a CLI-themed sidebar view.

## Scope

### In Scope
- Sidebar ItemView with monospace terminal/CRT aesthetic
- Timer engine: Focus, Break, Long Break phases, configurable cycles
- Settings: durations for all phases, cycles before long break
- Commands: open sidebar, start, stop
- DOM built via `createEl()`/`createDiv()`, zero `innerHTML`
- Obsidian CSS variables only; `Date.now()` drift correction

### Out of Scope
- Notifications, sound alerts, modal mode, multiple presets
- Test infrastructure (separate change)
- Modifications to existing cloudimage-uploader plugin

## Capabilities

### New Capabilities
- `timer-engine`: State machine (IDLE → WORKING → BREAK → LONG_BREAK), cycle counting, `registerInterval()`-based tick with `Date.now()` drift correction.
- `terminal-ui`: ItemView with CLI aesthetic — ASCII borders, `$ start`/`$ stop`/`$ reset` command-prompt buttons, monospace via `--font-monospace`, CRT glow via `text-shadow`.
- `plugin-lifecycle`: Command registration (open sidebar, start, stop), view registration, settings tab wiring, onload/onunload.
- `timer-settings`: PluginSettingTab with inputs for focus, break, long break durations, and cycles before long break. Persisted via `loadData()`/`saveData()`.

### Modified Capabilities
None — greenfield plugin.

## Approach

CSS-Simulated Terminal with HTML Elements (Approach 2 per exploration). ItemView `contentEl` with `<div>` layout styled as CLI. Box-drawing Unicode borders, `<button>` elements as shell prompts. Files: `src/timer.ts` (state machine), `src/view.ts` (ItemView), `src/settings.ts` (SettingTab), `src/types.ts` (interfaces), `main.ts` (entry). Build isolated to `pomodoro-timer/main.js`.

## Affected Areas

| Path | Impact |
|------|--------|
| `pomodoro-timer/` | New — 12 files per exploration structure |
| `openspec/config.yaml` | Modified — add pomodoro-timer context |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sidebar competition with other plugins | Medium | Dual access: command palette + sidebar |
| Monospace font width variance across themes | Low | CSS borders over character alignment |
| Build output collision with root `main.js` | Low | Verify esbuild output path before first build |

## Rollback Plan

1. Delete `pomodoro-timer/` directory
2. Revert `openspec/config.yaml` context line
3. Plugin is fully self-contained — no other files touched

## Dependencies

- Obsidian SDK 1.7 (already in project)
- No external npm packages beyond Obsidian types

## Success Criteria

- [ ] `npm run build` in `pomodoro-timer/` produces `main.js` without errors
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Sidebar opens/closes via command palette, displays timer UI
- [ ] Timer cycles Focus → Break → Long Break with configurable durations
- [ ] Start/stop/reset controls function correctly
- [ ] UI respects Obsidian dark/light themes via CSS variables
- [ ] Zero `innerHTML`, zero bare `setInterval`, zero global `app`
