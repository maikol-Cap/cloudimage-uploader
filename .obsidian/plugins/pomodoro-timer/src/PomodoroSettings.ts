import { App, PluginSettingTab } from 'obsidian';
import PomodoroTimerPlugin from '../main';
import { PluginSettings, DEFAULT_SETTINGS } from './types';

export class PomodoroSettingTab extends PluginSettingTab {
  plugin: PomodoroTimerPlugin;

  constructor(app: App, plugin: PomodoroTimerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Pomodoro Timer Settings' });

    this.createDurationSetting(
      containerEl,
      'Focus Duration (minutes)',
      'Duration of focus sessions in minutes',
      'focusDuration'
    );

    this.createDurationSetting(
      containerEl,
      'Short Break Duration (minutes)',
      'Duration of short breaks in minutes',
      'shortBreakDuration'
    );

    this.createDurationSetting(
      containerEl,
      'Long Break Duration (minutes)',
      'Duration of long breaks in minutes',
      'longBreakDuration'
    );
  }

  private createDurationSetting(
    containerEl: HTMLElement,
    name: string,
    desc: string,
    key: keyof PluginSettings
  ): void {
    const setting = containerEl.createDiv({ cls: 'setting-item' });
    
    const infoDiv = setting.createDiv({ cls: 'setting-item-info' });
    infoDiv.createDiv({ cls: 'setting-item-name', text: name });
    infoDiv.createDiv({ cls: 'setting-item-description', text: desc });
    
    const controlDiv = setting.createDiv({ cls: 'setting-item-control' });
    
    const input = controlDiv.createEl('input', {
      type: 'number',
      cls: 'pomodoro-duration-input',
      attr: {
        min: '1',
        max: '120',
        value: String(this.plugin.settings[key])
      }
    });

    input.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      let value = parseInt(target.value, 10);
      
      // Validate input
      if (isNaN(value) || value < 1) {
        value = DEFAULT_SETTINGS[key];
      } else if (value > 120) {
        value = 120;
      }
      
      target.value = String(value);
      this.plugin.settings[key] = value;
      await this.plugin.saveSettings();
    });
  }
}