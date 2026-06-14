# timer-settings Specification

## Purpose

PluginSettingTab for configuring Pomodoro durations, cycle count, and optional CRT glow. Persisted via Obsidian Data API (`loadData()`/`saveData()`).

## Requirements

### Requirement: Duration Configuration

The system MUST provide 3 number inputs with sentence-case labels: "Work duration (minutes)", "Break duration (minutes)", "Long break duration (minutes)". Defaults SHALL be: 25, 5, 15. Minimum SHALL be 1 for each.

#### Scenario: User changes work duration

- GIVEN settings tab is open
- WHEN user sets "Work duration (minutes)" to 30 and closes settings
- THEN `saveData()` SHALL persist `workDuration: 30`, and timer SHALL use 30 minutes

#### Scenario: Invalid input clamped

- GIVEN settings tab is open
- WHEN user enters 0 or negative value
- THEN value SHALL clamp to minimum of 1

### Requirement: Cycle Configuration

The system MUST provide a number input labeled "Cycles before long break". Default SHALL be 4. Minimum SHALL be 1.

#### Scenario: User changes cycle count

- GIVEN settings tab is open
- WHEN user sets "Cycles before long break" to 3
- THEN after 3 focus sessions, timer SHALL transition to LONG_BREAK

### Requirement: Data Persistence

The system MUST use `loadData()` to restore settings on startup. The system MUST use `saveData()` to persist on every change. Settings type interface SHALL define: `workDuration`, `breakDuration`, `longBreakDuration`, `cyclesBeforeLongBreak`, `crtGlow`.

#### Scenario: Settings survive restart

- GIVEN user configured work=30, break=10
- WHEN Obsidian restarts
- THEN `loadData()` SHALL return `{ workDuration: 30, breakDuration: 10, ... }` with all fields

#### Scenario: Default settings on first run

- GIVEN no saved data exists
- WHEN plugin loads for the first time
- THEN settings SHALL use defaults: work=25, break=5, longBreak=15, cycles=4, crtGlow=false

### Requirement: CRT Glow Toggle

The system MAY provide a toggle labeled "Enable CRT glow effect". Default SHALL be off (`false`).

#### Scenario: Toggle CRT glow on

- GIVEN settings tab is open
- WHEN user enables "Enable CRT glow effect" toggle
- THEN `saveData()` persists `crtGlow: true` and view SHALL render with `text-shadow`
