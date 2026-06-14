import { Plugin } from "obsidian";
import type { PomodoroSettings, TimerState, TimerStatus } from "./types";
import { TimerPhase } from "./types";

export type TimerCallback = (state: TimerState) => void;

export class TimerEngine {
  private plugin: Plugin;
  private settings: PomodoroSettings;
  private listeners: Set<TimerCallback> = new Set();
  private status: TimerStatus = "idle";
  private phase: TimerPhase = TimerPhase.FOCUS;
  private remainingSeconds: number = 0;
  private totalSeconds: number = 0;
  private cyclesCompleted: number = 0;
  private tickStart: number = 0;
  private intervalId: number | null = null;

  constructor(plugin: Plugin, settings: PomodoroSettings) {
    this.plugin = plugin;
    this.settings = settings;
  }

  onStateChange(cb: TimerCallback): void {
    this.listeners.add(cb);
  }

  removeListener(cb: TimerCallback): void {
    this.listeners.delete(cb);
  }

  start(): void {
    if (this.status === "idle") {
      this.status = "running";
      this.phase = TimerPhase.FOCUS;
      this.remainingSeconds = this.settings.workDuration * 60;
      this.totalSeconds = this.remainingSeconds;
      this.cyclesCompleted = 0;
      this.startTicking();
      this.notify();
    } else if (this.status === "paused") {
      this.status = "running";
      this.startTicking();
      this.notify();
    }
  }

  pause(): void {
    if (this.status === "running") {
      this.status = "paused";
      this.stopTicking();
      this.notify();
    }
  }

  reset(): void {
    this.stopTicking();
    this.status = "idle";
    this.phase = TimerPhase.FOCUS;
    this.remainingSeconds = 0;
    this.totalSeconds = 0;
    this.cyclesCompleted = 0;
    this.notify();
  }

  destroy(): void {
    this.stopTicking();
    this.listeners.clear();
  }

  updateSettings(settings: PomodoroSettings): void {
    this.settings = settings;
  }

  getState(): TimerState {
    return {
      phase: this.phase,
      remainingSeconds: Math.round(this.remainingSeconds),
      totalSeconds: this.totalSeconds,
      status: this.status,
      cyclesCompleted: this.cyclesCompleted,
      cyclesBeforeLongBreak: this.settings.cyclesBeforeLongBreak,
    };
  }

  private startTicking(): void {
    if (this.intervalId !== null) {
      return;
    }
    this.tickStart = Date.now();
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, 1000);
    this.plugin.registerInterval(this.intervalId);
  }

  private stopTicking(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    if (this.status !== "running") {
      return;
    }

    const now = Date.now();
    const delta = (now - this.tickStart) / 1000;
    this.tickStart = now;

    this.remainingSeconds = Math.max(0, this.remainingSeconds - delta);

    if (this.remainingSeconds <= 0) {
      this.remainingSeconds = 0;
      this.transitionPhase();
    }

    this.notify();
  }

  private transitionPhase(): void {
    if (this.phase === TimerPhase.FOCUS) {
      this.cyclesCompleted++;
      if (this.cyclesCompleted >= this.settings.cyclesBeforeLongBreak) {
        this.phase = TimerPhase.LONG_BREAK;
        this.remainingSeconds = this.settings.longBreakDuration * 60;
      } else {
        this.phase = TimerPhase.BREAK;
        this.remainingSeconds = this.settings.breakDuration * 60;
      }
    } else {
      this.phase = TimerPhase.FOCUS;
      this.remainingSeconds = this.settings.workDuration * 60;
    }
    this.totalSeconds = this.remainingSeconds;
    this.tickStart = Date.now();
  }

  private notify(): void {
    const state = this.getState();
    for (const cb of this.listeners) {
      cb(state);
    }
  }
}
