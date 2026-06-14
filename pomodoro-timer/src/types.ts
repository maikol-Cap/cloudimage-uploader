export enum TimerPhase {
  FOCUS = "focus",
  BREAK = "break",
  LONG_BREAK = "long_break",
}

export interface PomodoroSettings {
  workDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  cyclesBeforeLongBreak: number;
  crtGlow: boolean;
}

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  phase: TimerPhase;
  remainingSeconds: number;
  totalSeconds: number;
  status: TimerStatus;
  cyclesCompleted: number;
  cyclesBeforeLongBreak: number;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  cyclesBeforeLongBreak: 4,
  crtGlow: false,
};
