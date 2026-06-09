import { TimerState, TimerMode, TimerSettings, TimerContext } from './types';

export class PomodoroTimer {
  private state: TimerState = 'IDLE';
  private mode: TimerMode = 'FOCUS';
  private settings: TimerSettings;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private totalMs: number = 0;
  private remainingMs: number = 0;
  private tickIntervalId: number | null = null;
  private _onTick: ((ctx: TimerContext) => void) | null = null;
  private _onComplete: (() => void) | null = null;

  constructor(settings: TimerSettings) {
    this.settings = settings;
    this.totalMs = this.getModeDuration(this.mode);
    this.remainingMs = this.totalMs;
  }

  private getModeDuration(mode: TimerMode): number {
    switch (mode) {
      case 'FOCUS':
        return this.settings.focusDuration * 60 * 1000;
      case 'SHORT_BREAK':
        return this.settings.shortBreakDuration * 60 * 1000;
      case 'LONG_BREAK':
        return this.settings.longBreakDuration * 60 * 1000;
    }
  }

  private calculateProgress(): number {
    if (this.totalMs === 0) return 0;
    return 1 - (this.remainingMs / this.totalMs);
  }

  public start(): TimerContext {
    if (this.state !== 'IDLE') {
      return this.getContext();
    }

    this.state = 'RUNNING';
    this.startTime = Date.now();
    this.totalMs = this.getModeDuration(this.mode);
    this.remainingMs = this.totalMs;

    return this.getContext();
  }

  public pause(): TimerContext {
    if (this.state !== 'RUNNING') {
      return this.getContext();
    }

    this.state = 'PAUSED';
    this.pausedTime = Date.now();
    const elapsed = this.pausedTime - this.startTime;
    this.remainingMs = Math.max(0, this.totalMs - elapsed);

    return this.getContext();
  }

  public resume(): TimerContext {
    if (this.state !== 'PAUSED') {
      return this.getContext();
    }

    this.state = 'RUNNING';
    this.startTime = Date.now() - (this.totalMs - this.remainingMs);

    return this.getContext();
  }

  public reset(): TimerContext {
    this.state = 'IDLE';
    this.startTime = 0;
    this.pausedTime = 0;
    this.totalMs = this.getModeDuration(this.mode);
    this.remainingMs = this.totalMs;

    return this.getContext();
  }

  public switchMode(mode: TimerMode): TimerContext {
    if (this.state !== 'IDLE' && this.state !== 'COMPLETED') {
      return this.getContext();
    }

    this.mode = mode;
    this.state = 'IDLE';
    this.startTime = 0;
    this.pausedTime = 0;
    this.totalMs = this.getModeDuration(mode);
    this.remainingMs = this.totalMs;

    return this.getContext();
  }

  public tick(): TimerContext {
    if (this.state !== 'RUNNING') {
      return this.getContext();
    }

    const now = Date.now();
    const elapsed = now - this.startTime;
    this.remainingMs = Math.max(0, this.totalMs - elapsed);

    if (this.remainingMs <= 0) {
      this.state = 'COMPLETED';
      this.remainingMs = 0;
    }

    return this.getContext();
  }

  public getContext(): TimerContext {
    return {
      state: this.state,
      mode: this.mode,
      remainingMs: this.remainingMs,
      totalMs: this.totalMs,
      progress: this.calculateProgress()
    };
  }

  public updateSettings(settings: TimerSettings): void {
    this.settings = settings;
    if (this.state === 'IDLE') {
      this.totalMs = this.getModeDuration(this.mode);
      this.remainingMs = this.totalMs;
    }
  }

  // --- Tick management (owned by plugin, not view) ---

  /**
   * Start the tick interval. Returns the interval ID for plugin.registerInterval().
   * The timer ticks independently of any view.
   */
  public startTick(): number {
    this.stopTick();
    this.tickIntervalId = window.setInterval(() => {
      const ctx = this.tick();
      if (this._onTick) {
        this._onTick(ctx);
      }
      if (ctx.state === 'COMPLETED') {
        this.stopTick();
        if (this._onComplete) {
          this._onComplete();
        }
      }
    }, 1000);
    return this.tickIntervalId;
  }

  public stopTick(): void {
    if (this.tickIntervalId !== null) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
  }

  public set onTick(callback: ((ctx: TimerContext) => void) | null) {
    this._onTick = callback;
  }

  public set onComplete(callback: (() => void) | null) {
    this._onComplete = callback;
  }

  public get isTicking(): boolean {
    return this.tickIntervalId !== null;
  }
}