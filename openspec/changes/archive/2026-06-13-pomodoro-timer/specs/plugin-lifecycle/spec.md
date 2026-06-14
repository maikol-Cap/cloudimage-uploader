# Delta for plugin-lifecycle

## ADDED Requirements

### Requirement: Plugin Entry Point

The system MUST export a default class extending `Plugin`. `onload()` MUST register the ItemView, add 3 commands via `addCommand()`, and add the settings tab via `addSettingTab()`. `onunload()` MUST rely on Obsidian Component lifecycle for cleanup — no manual disposal.

#### Scenario: Plugin loads successfully

- GIVEN plugin is enabled in Obsidian
- WHEN Obsidian calls onload()
- THEN view is registered, 3 commands are added, settings tab is wired

#### Scenario: Plugin unloads cleanly

- GIVEN plugin is loaded with active view and running timer
- WHEN Obsidian unloads the plugin
- THEN all registered intervals, views, and commands SHALL be cleaned up via Component lifecycle

### Requirement: Command Registration

The system MUST register 3 commands via `addCommand()` with IDs: `open-pomodoro`, `start-pomodoro`, `stop-pomodoro`. The system MUST NOT assign default hotkeys.

#### Scenario: Commands appear in palette

- GIVEN plugin is loaded
- WHEN user opens command palette
- THEN "Pomodoro Timer: Open sidebar", "Pomodoro Timer: Start", and "Pomodoro Timer: Stop" SHALL appear

#### Scenario: Start command from palette

- GIVEN timer is IDLE and view is open
- WHEN user runs "Pomodoro Timer: Start" from command palette
- THEN timer transitions to WORKING

#### Scenario: No default hotkeys

- GIVEN plugin loads
- WHEN checking command hotkey assignments
- THEN no command SHALL have a pre-assigned hotkey

### Requirement: View and Settings Wiring

The system MUST register the ItemView via `registerView(VIEW_TYPE, (leaf) => new PomodoroView(leaf))`. The system MUST add the settings tab via `addSettingTab(new PomodoroSettingTab(app, this))`.

#### Scenario: View registered for right sidebar

- GIVEN plugin onload
- WHEN `registerView()` is called
- THEN Obsidian can instantiate the view for the right sidebar

#### Scenario: Settings tab accessible

- GIVEN plugin is loaded
- WHEN user opens Settings → Community Plugins → Pomodoro Timer
- THEN the settings tab SHALL render the configuration UI
