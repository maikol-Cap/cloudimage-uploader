import { Plugin } from "obsidian";
import { UploadModal } from "./src/modal";
import { CloudImageSettingTab } from "./src/settings";
import { DEFAULT_SETTINGS } from "./src/types";
import type { CloudImagePluginSettings } from "./src/types";

export default class CloudImagePlugin extends Plugin {
  settings!: CloudImagePluginSettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.addSettingTab(new CloudImageSettingTab(this.app, this));

    this.addCommand({
      id: "cloudimage-upload",
      name: "CloudImage: Upload image",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "U" }],
      callback: () => {
        new UploadModal(this.app, this).open();
      },
    });
  }
}
