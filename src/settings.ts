import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { ImgBBClient } from "./api";
import type CloudImagePlugin from "../main";

export class CloudImageSettingTab extends PluginSettingTab {
  plugin: CloudImagePlugin;

  constructor(app: App, plugin: CloudImagePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    let testBtn: HTMLButtonElement;

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your ImgBB API key from https://api.imgbb.com")
      .addText((text) =>
        text
          .setPlaceholder("Enter your API key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveData(this.plugin.settings);
            if (testBtn) testBtn.disabled = value.trim().length === 0;
          }),
      );

    new Setting(containerEl)
      .setName("Test Connection")
      .setDesc("Verify that your API key is valid")
      .addButton((button) => {
        testBtn = button.buttonEl;
        button
          .setButtonText("Test")
          .setDisabled(this.plugin.settings.apiKey.length === 0)
          .onClick(async () => {
            const apiKey = this.plugin.settings.apiKey;
            if (!apiKey) return;

            button.setDisabled(true);
            button.setButtonText("Testing\u2026");

            try {
              const valid = await ImgBBClient.testConnection(apiKey);
              new Notice(
                valid
                  ? "\u2705 Connection successful \u2014 API key is valid"
                  : "\u274C Invalid API key \u2014 check your key and try again",
              );
            } catch {
              new Notice("\u274C Connection failed \u2014 check your network");
            }

            button.setButtonText("Test");
            button.setDisabled(false);
          });
      });
  }
}
