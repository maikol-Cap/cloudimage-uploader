import { App, PluginSettingTab, Setting } from "obsidian";
import type PomodoroPlugin from "../main";

export class PomodoroSettingTab extends PluginSettingTab {
  plugin: PomodoroPlugin;

  constructor(app: App, plugin: PomodoroPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Work duration (minutes)")
      .setDesc("Minutes for each focus session")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(String(this.plugin.settings.workDuration));
        text.onChange(async (value) => {
          const num = Math.max(1, parseInt(value, 10) || 1);
          if (num !== parseInt(value, 10)) {
            text.setValue(String(num));
          }
          this.plugin.settings.workDuration = num;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.engine.updateSettings(this.plugin.settings);
        });
      });

    new Setting(containerEl)
      .setName("Break duration (minutes)")
      .setDesc("Minutes for short breaks between focus sessions")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(String(this.plugin.settings.breakDuration));
        text.onChange(async (value) => {
          const num = Math.max(1, parseInt(value, 10) || 1);
          if (num !== parseInt(value, 10)) {
            text.setValue(String(num));
          }
          this.plugin.settings.breakDuration = num;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.engine.updateSettings(this.plugin.settings);
        });
      });

    new Setting(containerEl)
      .setName("Long break duration (minutes)")
      .setDesc("Minutes for long breaks after completing the cycle count")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(String(this.plugin.settings.longBreakDuration));
        text.onChange(async (value) => {
          const num = Math.max(1, parseInt(value, 10) || 1);
          if (num !== parseInt(value, 10)) {
            text.setValue(String(num));
          }
          this.plugin.settings.longBreakDuration = num;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.engine.updateSettings(this.plugin.settings);
        });
      });

    new Setting(containerEl)
      .setName("Cycles before long break")
      .setDesc("Number of focus sessions before a long break triggers")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(String(this.plugin.settings.cyclesBeforeLongBreak));
        text.onChange(async (value) => {
          const num = Math.max(1, parseInt(value, 10) || 1);
          if (num !== parseInt(value, 10)) {
            text.setValue(String(num));
          }
          this.plugin.settings.cyclesBeforeLongBreak = num;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.engine.updateSettings(this.plugin.settings);
        });
      });

    new Setting(containerEl)
      .setName("Enable CRT glow effect")
      .setDesc("Add a subtle text glow to the timer display for a retro terminal look")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.crtGlow);
        toggle.onChange(async (value) => {
          this.plugin.settings.crtGlow = value;
          await this.plugin.saveData(this.plugin.settings);
        });
      });
  }
}
