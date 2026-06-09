import { Plugin } from "obsidian";
import { PomodoroSettingTab } from "./src/PomodoroSettings";
import { DEFAULT_SETTINGS } from "./src/types";
import type { PluginSettings } from "./src/types";

export default class PomodoroTimerPlugin extends Plugin {
  settings!: PluginSettings;

  async onload() {
    console.log("Loading Pomodoro Timer plugin");
    
    // Load settings
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    
    // Add settings tab
    this.addSettingTab(new PomodoroSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onunload() {
    console.log("Unloading Pomodoro Timer plugin");
  }
}