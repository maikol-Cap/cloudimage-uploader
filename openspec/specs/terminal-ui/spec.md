# terminal-ui Specification

## Purpose

ItemView with CSS-simulated terminal aesthetic for the Obsidian right sidebar. Monospace font, box-drawing Unicode borders, CLI-prompt buttons. Zero `innerHTML`. Uses Obsidian CSS variables exclusively.

## Requirements

### Requirement: ItemView Registration

The system MUST extend `ItemView`. `getViewType()` MUST return a unique identifier. `getDisplayText()` SHALL return "Pomodoro Timer". `getIcon()` SHALL target the right sidebar.

#### Scenario: View opens in right sidebar

- GIVEN plugin is loaded
- WHEN user runs "Open Pomodoro Timer" command
- THEN ItemView renders in right sidebar with terminal-themed UI

### Requirement: Terminal Aesthetic

The system MUST use `--font-monospace` for all text. Box-drawing Unicode characters (╭ ╮ ╰ ╯ │) SHALL form borders. Buttons SHALL use CLI-prompt labels: `$ start`, `$ stop`, `$ reset`. The system MUST use Obsidian CSS variables exclusively for colors — no hardcoded hex values.

#### Scenario: Dark theme rendering

- GIVEN Obsidian is in dark mode
- WHEN view renders
- THEN colors SHALL resolve via `--background-primary`, `--text-normal`, `--text-accent`

#### Scenario: Light theme rendering

- GIVEN Obsidian is in light mode
- WHEN view renders
- THEN the same CSS variables SHALL produce light-appropriate colors

#### Scenario: CRT glow disabled by default

- GIVEN CRT glow setting is off
- WHEN view renders
- THEN text SHALL NOT have `text-shadow`

#### Scenario: CRT glow enabled

- GIVEN CRT glow setting is on
- WHEN view renders
- THEN text MAY have `text-shadow` using `--text-accent` as progressive enhancement

### Requirement: DOM Construction

The system MUST build all elements via `createEl()` or `createDiv()`. `innerHTML` MUST NOT be used anywhere in the view.

#### Scenario: No innerHTML in view

- GIVEN view renders
- WHEN inspecting DOM
- THEN all child elements SHALL be created via Obsidian DOM helpers, not string assignment
