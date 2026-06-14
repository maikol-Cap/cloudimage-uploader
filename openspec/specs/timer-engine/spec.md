# timer-engine Specification

## Purpose

Pure Pomodoro state machine with drift-corrected countdown and cycle tracking. No DOM or UI dependencies. Uses `registerInterval()` for lifecycle-safe ticks and `Date.now()` for drift correction.

## Requirements

### Requirement: State Machine

The system MUST manage phases: IDLE, WORKING, BREAK, LONG_BREAK. Valid transitions:

| From | To | Trigger |
|------|-----|---------|
| IDLE | WORKING | start() |
| WORKING | BREAK | countdown=0, cycle `<` cyclesBeforeLongBreak |
| WORKING | LONG_BREAK | countdown=0, cycle `>=` cyclesBeforeLongBreak |
| BREAK | WORKING | countdown=0 |
| LONG_BREAK | WORKING | countdown=0 |
| any | IDLE | stop() or reset() |

#### Scenario: Start from idle

- GIVEN timer is IDLE
- WHEN user calls start(focusDuration)
- THEN state MUST be WORKING and countdown set to focusDuration

#### Scenario: Pause and resume

- GIVEN timer is WORKING
- WHEN user calls pause()
- THEN countdown freezes
- WHEN resume() is called
- THEN countdown continues from frozen point

#### Scenario: Stop returns to idle

- GIVEN timer in WORKING, BREAK, or LONG_BREAK
- WHEN user calls stop()
- THEN state MUST be IDLE and countdown reset to configured duration

### Requirement: Drift-Corrected Countdown

The system MUST compute elapsed time via `Date.now()` deltas. The system MUST use `registerInterval()` for the tick callback. Bare `setInterval` MUST NOT be used.

#### Scenario: Drift correction on tick

- GIVEN timer ticking via `registerInterval()` callback
- WHEN callback fires
- THEN remaining = previous - (Date.now() - tickStart), NOT remaining = previous - 1

#### Scenario: Tick cleanup on unload

- GIVEN timer started with `registerInterval()`
- WHEN Component is unloaded
- THEN interval callback SHALL be automatically unregistered

### Requirement: Cycle Tracking

The system SHALL maintain a zero-based cycle counter. A WORKING→BREAK or WORKING→LONG_BREAK transition SHALL increment it. `reset()` SHALL set counter to 0.

#### Scenario: Cycle increments after focus

- GIVEN cycle=0, timer in WORKING
- WHEN countdown reaches 0
- THEN cycle MUST be 1

#### Scenario: Reset clears cycle

- GIVEN cycle=3, timer in WORKING
- WHEN reset() is called
- THEN state=IDLE, countdown=0, cycle=0
