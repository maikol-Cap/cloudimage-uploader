import { ItemView, WorkspaceLeaf } from 'obsidian';
import { PomodoroTimer } from './PomodoroTimer';
import { TimerContext, TimerMode } from './types';

export const VIEW_TYPE_POMODORO = 'pomodoro-timer-view';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class PomodoroView extends ItemView {
  private timer: PomodoroTimer;

  // DOM elements
  private progressRing: SVGCircleElement | null = null;
  private glowRing: SVGCircleElement | null = null;
  private timeDisplay: HTMLDivElement | null = null;
  private modeLabel: HTMLDivElement | null = null;
  private playBtn: HTMLButtonElement | null = null;
  private pauseBtn: HTMLButtonElement | null = null;
  private resetBtn: HTMLButtonElement | null = null;
  private modeBtns: Map<TimerMode, HTMLButtonElement> = new Map();

  // SVG constants
  private readonly RADIUS = 90;
  private readonly CIRCUMFERENCE = 2 * Math.PI * 90; // ~565.48

  constructor(leaf: WorkspaceLeaf, timer: PomodoroTimer) {
    super(leaf);
    this.timer = timer;
  }

  getViewType(): string {
    return VIEW_TYPE_POMODORO;
  }

  getDisplayText(): string {
    return 'Pomodoro Timer';
  }

  getIcon(): string {
    return 'clock';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('pomodoro-container');

    // Mode selector
    const modeContainer = container.createDiv({ cls: 'pomodoro-mode-selector' });
    this.createModeButton(modeContainer, 'FOCUS', 'Focus');
    this.createModeButton(modeContainer, 'SHORT_BREAK', 'Short Break');
    this.createModeButton(modeContainer, 'LONG_BREAK', 'Long Break');

    // SVG timer circle
    const svgContainer = container.createDiv({ cls: 'pomodoro-svg-container' });
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.addClass('pomodoro-svg');

    // Defs for gradient and glow filter
    const defs = document.createElementNS(SVG_NS, 'defs');

    // Linear gradient
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', 'timerGradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', 'var(--pomo-accent)');
    gradient.appendChild(stop1);

    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', 'var(--pomo-accent-secondary)');
    gradient.appendChild(stop2);

    defs.appendChild(gradient);

    // Glow filter
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', 'glow');

    const feGaussianBlur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    feGaussianBlur.setAttribute('stdDeviation', '3');
    feGaussianBlur.setAttribute('result', 'blur');
    filter.appendChild(feGaussianBlur);

    const feMerge = document.createElementNS(SVG_NS, 'feMerge');
    const feMergeNode1 = document.createElementNS(SVG_NS, 'feMergeNode');
    feMergeNode1.setAttribute('in', 'blur');
    feMerge.appendChild(feMergeNode1);

    const feMergeNode2 = document.createElementNS(SVG_NS, 'feMergeNode');
    feMergeNode2.setAttribute('in', 'SourceGraphic');
    feMerge.appendChild(feMergeNode2);

    filter.appendChild(feMerge);
    defs.appendChild(filter);

    svg.appendChild(defs);

    // Background ring
    const bgRing = document.createElementNS(SVG_NS, 'circle');
    bgRing.setAttribute('class', 'bg-ring');
    bgRing.setAttribute('cx', '100');
    bgRing.setAttribute('cy', '100');
    bgRing.setAttribute('r', String(this.RADIUS));
    svg.appendChild(bgRing);

    // Progress ring
    this.progressRing = document.createElementNS(SVG_NS, 'circle');
    this.progressRing.setAttribute('class', 'progress-ring');
    this.progressRing.setAttribute('cx', '100');
    this.progressRing.setAttribute('cy', '100');
    this.progressRing.setAttribute('r', String(this.RADIUS));
    this.progressRing.setAttribute('stroke-dasharray', String(this.CIRCUMFERENCE));
    this.progressRing.setAttribute('stroke-dashoffset', '0');
    svg.appendChild(this.progressRing);

    // Glow ring
    this.glowRing = document.createElementNS(SVG_NS, 'circle');
    this.glowRing.setAttribute('class', 'glow-ring');
    this.glowRing.setAttribute('cx', '100');
    this.glowRing.setAttribute('cy', '100');
    this.glowRing.setAttribute('r', String(this.RADIUS));
    this.glowRing.setAttribute('stroke-dasharray', String(this.CIRCUMFERENCE));
    this.glowRing.setAttribute('stroke-dashoffset', '0');
    svg.appendChild(this.glowRing);

    svgContainer.appendChild(svg);

    // Time display (centered in circle)
    this.timeDisplay = container.createDiv({ cls: 'pomodoro-time' });
    this.timeDisplay.setText(this.formatTime(this.timer.getContext().remainingMs));

    // Mode label
    this.modeLabel = container.createDiv({ cls: 'pomodoro-mode-label' });
    this.modeLabel.setText(this.getModeLabel(this.timer.getContext().mode));

    // Controls
    const controls = container.createDiv({ cls: 'pomodoro-controls' });

    this.playBtn = controls.createEl('button', {
      cls: 'pomodoro-btn pomodoro-btn-play',
      attr: { 'aria-label': 'Play' }
    });
    this.playBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><polygon points="5,3 19,12 5,21" /></svg>`;
    this.playBtn.addEventListener('click', () => this.handlePlay());

    this.pauseBtn = controls.createEl('button', {
      cls: 'pomodoro-btn pomodoro-btn-pause',
      attr: { 'aria-label': 'Pause' }
    });
    this.pauseBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>`;
    this.pauseBtn.addEventListener('click', () => this.handlePause());

    this.resetBtn = controls.createEl('button', {
      cls: 'pomodoro-btn pomodoro-btn-reset',
      attr: { 'aria-label': 'Reset' }
    });
    this.resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>`;
    this.resetBtn.addEventListener('click', () => this.handleReset());

    // Initial render
    this.render(this.timer.getContext());

    // Register timer callbacks — timer ticks independently in the plugin
    this.timer.onTick = (ctx) => {
      this.render(ctx);
    };
    this.timer.onComplete = () => {
      this.applyCompletionAnimation();
    };
  }

  async onClose(): Promise<void> {
    // Disconnect callbacks — timer keeps ticking in plugin
    this.timer.onTick = null;
    this.timer.onComplete = null;
  }

  /**
   * Reconnect to timer callbacks when view is reopened.
   * Called by the plugin when active-leaf-change fires.
   */
  reconnectToTimer(): void {
    // Only reconnect if DOM is ready (onOpen has run)
    if (!this.timeDisplay) return;

    this.timer.onTick = (ctx) => {
      this.render(ctx);
    };
    this.timer.onComplete = () => {
      this.applyCompletionAnimation();
    };

    // Sync view with current timer state
    this.render(this.timer.getContext());
  }

  // --- Mode switching ---

  private createModeButton(container: HTMLElement, mode: TimerMode, label: string): void {
    const btn = container.createEl('button', {
      cls: 'pomodoro-mode-btn',
      text: label,
      attr: { 'data-mode': mode }
    });
    this.modeBtns.set(mode, btn);
    btn.addEventListener('click', () => this.handleSwitchMode(mode));
  }

  private handleSwitchMode(mode: TimerMode): void {
    const ctx = this.timer.switchMode(mode);
    this.render(ctx);
  }

  // --- Timer controls ---

  private handlePlay(): void {
    const ctx = this.timer.getContext();

    if (ctx.state === 'IDLE') {
      const result = this.timer.start();
      this.applyPlayAnimation();
      this.applyRipple();
      this.render(result);
    } else if (ctx.state === 'PAUSED') {
      const result = this.timer.resume();
      this.applyPlayAnimation();
      this.applyRipple();
      this.render(result);
    }
  }

  private handlePause(): void {
    const ctx = this.timer.getContext();
    if (ctx.state === 'RUNNING') {
      const result = this.timer.pause();
      this.applyPauseAnimation();
      this.render(result);
    }
  }

  private handleReset(): void {
    this.clearAnimations();
    const result = this.timer.reset();
    this.render(result);
  }

  // --- Ripple effect (play button only) ---

  private applyRipple(): void {
    if (!this.playBtn) return;
    const ripple = document.createElement('span');
    ripple.addClass('ripple');
    this.playBtn.appendChild(ripple);
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  // --- Rendering ---

  private render(ctx: TimerContext): void {
    // Update time display
    if (this.timeDisplay) {
      this.timeDisplay.setText(this.formatTime(ctx.remainingMs));
    }

    // Update progress circle
    this.updateProgress(ctx.progress);

    // Update mode label
    if (this.modeLabel) {
      this.modeLabel.setText(this.getModeLabel(ctx.mode));
    }

    // Update mode buttons active state
    this.modeBtns.forEach((btn, mode) => {
      btn.toggleClass('active', mode === ctx.mode);
    });

    // Update button visibility
    this.updateButtonVisibility(ctx.state);
  }

  private updateProgress(progress: number): void {
    if (!this.progressRing || !this.glowRing) return;

    const offset = this.CIRCUMFERENCE * (1 - progress);
    this.progressRing.setAttribute('stroke-dashoffset', String(offset));
    this.glowRing.setAttribute('stroke-dashoffset', String(offset));
  }

  private updateButtonVisibility(state: string): void {
    if (!this.playBtn || !this.pauseBtn || !this.resetBtn) return;

    const isRunning = state === 'RUNNING';
    const isIdle = state === 'IDLE';
    const isCompleted = state === 'COMPLETED';

    // Play button: visible when IDLE or PAUSED
    this.playBtn.classList.toggle('hidden', isRunning || isCompleted);
    // Pause button: visible when RUNNING
    this.pauseBtn.classList.toggle('hidden', !isRunning);
    // Reset button: visible when not IDLE
    this.resetBtn.classList.toggle('hidden', isIdle);
  }

  // --- Animations ---

  private applyPlayAnimation(): void {
    const svgContainer = this.containerEl.querySelector('.pomodoro-svg-container');
    const timeEl = this.containerEl.querySelector('.pomodoro-time');
    const glowRing = this.containerEl.querySelector('.glow-ring');

    svgContainer?.addClass('pomodoro-animate-play');
    timeEl?.addClass('pomodoro-animate-time-pulse');
    glowRing?.addClass('pomodoro-glow-active');

    // Remove play pulse after animation
    setTimeout(() => {
      svgContainer?.removeClass('pomodoro-animate-play');
      timeEl?.removeClass('pomodoro-animate-time-pulse');
    }, 300);
  }

  private applyPauseAnimation(): void {
    const glowRing = this.containerEl.querySelector('.glow-ring');
    glowRing?.removeClass('pomodoro-glow-active');
  }

  private applyCompletionAnimation(): void {
    const svgContainer = this.containerEl.querySelector('.pomodoro-svg-container');
    const timeEl = this.containerEl.querySelector('.pomodoro-time');

    svgContainer?.addClass('pomodoro-animate-completion');
    timeEl?.addClass('pomodoro-time-completed');

    // After initial pulse, switch to breathing
    setTimeout(() => {
      svgContainer?.removeClass('pomodoro-animate-completion');
      svgContainer?.addClass('pomodoro-animate-breathing');
    }, 1000);
  }

  private clearAnimations(): void {
    const svgContainer = this.containerEl.querySelector('.pomodoro-svg-container');
    const timeEl = this.containerEl.querySelector('.pomodoro-time');
    const glowRing = this.containerEl.querySelector('.glow-ring');

    svgContainer?.removeClass('pomodoro-animate-play');
    svgContainer?.removeClass('pomodoro-animate-completion');
    svgContainer?.removeClass('pomodoro-animate-breathing');
    timeEl?.removeClass('pomodoro-animate-time-pulse');
    timeEl?.removeClass('pomodoro-time-completed');
    glowRing?.removeClass('pomodoro-glow-active');
  }

  // --- Utilities ---

  private formatTime(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private getModeLabel(mode: TimerMode): string {
    switch (mode) {
      case 'FOCUS':
        return 'Focus';
      case 'SHORT_BREAK':
        return 'Short Break';
      case 'LONG_BREAK':
        return 'Long Break';
    }
  }
}
