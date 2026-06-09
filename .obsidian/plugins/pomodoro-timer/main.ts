import { Plugin, WorkspaceLeaf } from 'obsidian';
import { PomodoroSettingTab } from './src/PomodoroSettings';
import { PomodoroView, VIEW_TYPE_POMODORO } from './src/PomodoroView';
import { PomodoroTimer } from './src/PomodoroTimer';
import { DEFAULT_SETTINGS } from './src/types';
import type { PluginSettings } from './src/types';

export default class PomodoroTimerPlugin extends Plugin {
  settings!: PluginSettings;
  timer!: PomodoroTimer;

  async onload() {
    console.log('Loading Pomodoro Timer plugin');

    // Load settings
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Initialize timer — lives as long as Obsidian is open
    this.timer = new PomodoroTimer(this.settings);

    // Start tick interval — registered for automatic cleanup on unload
    this.registerInterval(this.timer.startTick());

    // Register the view
    this.registerView(
      VIEW_TYPE_POMODORO,
      (leaf) => new PomodoroView(leaf, this.timer)
    );

    // Reconnect view when workspace changes (view reopens after sidebar close)
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        // Ensure any open view is connected to the timer callbacks
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_POMODORO);
        for (const leaf of leaves) {
          const view = leaf.view as PomodoroView;
          if (view && typeof view.reconnectToTimer === 'function') {
            view.reconnectToTimer();
          }
        }
      })
    );

    // Add ribbon icon
    this.addRibbonIcon('clock', 'Pomodoro Timer', () => {
      this.activateView();
    });

    // Register commands (prefixed with "Pomodoro Timer:")
    this.addCommand({
      id: 'pomodoro-focus',
      name: 'Pomodoro Timer: Start Focus',
      callback: () => {
        this.timer.switchMode('FOCUS');
        this.timer.start();
        this.activateView();
      }
    });

    this.addCommand({
      id: 'pomodoro-break',
      name: 'Pomodoro Timer: Start Short Break',
      callback: () => {
        this.timer.switchMode('SHORT_BREAK');
        this.timer.start();
        this.activateView();
      }
    });

    this.addCommand({
      id: 'pomodoro-long-break',
      name: 'Pomodoro Timer: Start Long Break',
      callback: () => {
        this.timer.switchMode('LONG_BREAK');
        this.timer.start();
        this.activateView();
      }
    });

    // Add settings tab
    this.addSettingTab(new PomodoroSettingTab(this.app, this));
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_POMODORO);

    if (leaves.length > 0) {
      // Use existing leaf
      leaf = leaves[0];
    } else {
      // Create new leaf in right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_POMODORO,
          active: true
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Update timer with new settings
    if (this.timer) {
      this.timer.updateSettings(this.settings);
    }
  }

  onunload() {
    console.log('Unloading Pomodoro Timer plugin');
    this.timer.stopTick();
  }
}
