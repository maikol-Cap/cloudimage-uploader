import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS } from "./src/types";
import type { PomodoroSettings } from "./src/types";
import { TimerEngine } from "./src/timer";
import { PomodoroView, VIEW_TYPE } from "./src/view";
import { PomodoroSettingTab } from "./src/settings";

export default class PomodoroPlugin extends Plugin {
  settings!: PomodoroSettings;
  engine!: TimerEngine;

  async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.engine = new TimerEngine(this, this.settings);

    this.registerView(VIEW_TYPE, (leaf) => {
      return new PomodoroView(leaf, this.engine, this.settings.crtGlow);
    });

    this.addCommand({
      id: "open-pomodoro",
      name: "Pomodoro Timer: Open sidebar",
      callback: async () => {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
        if (!leaf) {
          const rightLeaf = workspace.getRightLeaf(false);
          if (rightLeaf) {
            await rightLeaf.setViewState({ type: VIEW_TYPE, active: true });
          }
        }
        workspace.revealLeaf(
          leaf ?? workspace.getLeavesOfType(VIEW_TYPE)[0]
        );
      },
    });

    this.addCommand({
      id: "start-pomodoro",
      name: "Pomodoro Timer: Start",
      callback: () => {
        this.engine.start();
      },
    });

    this.addCommand({
      id: "stop-pomodoro",
      name: "Pomodoro Timer: Stop",
      callback: () => {
        this.engine.reset();
      },
    });

    this.addSettingTab(new PomodoroSettingTab(this.app, this));
  }
}
