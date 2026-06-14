import { ItemView, WorkspaceLeaf } from "obsidian";
import type { TimerState } from "./types";
import { TimerPhase } from "./types";
import type { TimerEngine } from "./timer";

export const VIEW_TYPE = "pomodoro-timer-view";

export class PomodoroView extends ItemView {
  private engine: TimerEngine;
  private crtGlow: boolean;
  private unsubscribe: (() => void) | null = null;

  private minutesEl!: HTMLDivElement;
  private secondsEl!: HTMLDivElement;
  private progressBar!: HTMLDivElement;
  private statusLine!: HTMLDivElement;
  private lastPhase: TimerPhase | null = null;
  private currentHue = Math.floor(Math.random() * 360);

  constructor(leaf: WorkspaceLeaf, engine: TimerEngine, crtGlow: boolean) {
    super(leaf);
    this.engine = engine;
    this.crtGlow = crtGlow;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Pomodoro Timer";
  }

  getIcon(): string {
    return "timer";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("pomodoro-terminal");

    if (this.crtGlow) {
      container.addClass("crt-glow");
    }

    // Top border
    const borderTop = container.createDiv({ cls: "pomodoro-border" });
    borderTop.setText("\u256D\u2500\u2500 Pomodoro \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256E");

    // Timer body
    const body = container.createDiv({ cls: "pomodoro-body" });

    const clock = body.createDiv({ cls: "pomodoro-clock" });
    this.minutesEl = clock.createDiv({ cls: "pomodoro-minutes" });
    this.minutesEl.setText("25");
    this.secondsEl = clock.createDiv({ cls: "pomodoro-seconds" });
    this.secondsEl.setText("00");

    this.statusLine = body.createDiv({ cls: "pomodoro-status" });
    this.statusLine.setText("IDLE \u00b7 Cycle 0/0");

    this.progressBar = body.createDiv({ cls: "pomodoro-progress" });
    this.progressBar.setText("");

    // Controls
    const controls = body.createDiv({ cls: "pomodoro-controls" });

    const startBtn = controls.createEl("button", { cls: "pomodoro-btn" });
    startBtn.setText("$ start");
    startBtn.addEventListener("click", () => {
      this.engine.start();
    });

    const pauseBtn = controls.createEl("button", { cls: "pomodoro-btn" });
    pauseBtn.setText("$ stop");
    pauseBtn.addEventListener("click", () => {
      this.engine.pause();
    });

    const resetBtn = controls.createEl("button", { cls: "pomodoro-btn" });
    resetBtn.setText("$ reset");
    resetBtn.addEventListener("click", () => {
      this.engine.reset();
    });

    // Bottom border
    const borderBottom = container.createDiv({ cls: "pomodoro-border" });
    borderBottom.setText("\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256F");

    // Subscribe to engine state changes
    const callback = (state: TimerState) => {
      this.render(state);
    };
    this.engine.onStateChange(callback);
    this.unsubscribe = () => this.engine.removeListener(callback);

    // Initial render
    this.render(this.engine.getState());
  }

  async onClose(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private render(state: TimerState): void {
    const mins = Math.floor(state.remainingSeconds / 60);
    const secs = state.remainingSeconds % 60;
    this.minutesEl.setText(String(mins).padStart(2, "0"));
    this.secondsEl.setText(String(secs).padStart(2, "0"));

    // Color change on phase transition only
    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      this.currentHue = (this.currentHue + 40 + Math.floor(Math.random() * 100)) % 360;
      const filterValue = `hue-rotate(${this.currentHue}deg)`;
      this.minutesEl.style.filter = filterValue;
      this.secondsEl.style.filter = filterValue;
      this.progressBar.style.filter = filterValue;
    }

    // Progress bar: 24 blocks wide
    if (state.totalSeconds > 0 && state.status !== "idle") {
      const progress = Math.min(1, Math.max(0, state.remainingSeconds / state.totalSeconds));
      const filledBlocks = Math.round(progress * 24);
      const emptyBlocks = 24 - filledBlocks;
      this.progressBar.setText("\u2588".repeat(filledBlocks) + "\u2591".repeat(emptyBlocks));
    } else {
      this.progressBar.setText("\u2591".repeat(24));
    }

    // Status line
    if (state.status === "idle") {
      this.statusLine.setText("IDLE \u00b7 Cycle 0/" + String(state.cyclesBeforeLongBreak));
    } else if (state.status === "paused") {
      const phaseName = this.phaseLabel(state.phase);
      this.statusLine.setText(
        phaseName + " (paused) \u00b7 Cycle " +
        String(state.cyclesCompleted) + "/" +
        String(state.cyclesBeforeLongBreak)
      );
    } else {
      const phaseName = this.phaseLabel(state.phase);
      this.statusLine.setText(
        phaseName + " \u00b7 Cycle " +
        String(state.cyclesCompleted) + "/" +
        String(state.cyclesBeforeLongBreak)
      );
    }
  }

  private phaseLabel(phase: TimerPhase): string {
    switch (phase) {
      case TimerPhase.FOCUS:
        return "FOCUS";
      case TimerPhase.BREAK:
        return "BREAK";
      case TimerPhase.LONG_BREAK:
        return "LONG BREAK";
    }
  }
}
