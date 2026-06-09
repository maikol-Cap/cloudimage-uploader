export type TimerState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
export type TimerMode = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

export interface TimerSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
}

export interface PluginSettings extends TimerSettings {}

export interface TimerContext {
  state: TimerState;
  mode: TimerMode;
  remainingMs: number;
  totalMs: number;
  progress: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15
};