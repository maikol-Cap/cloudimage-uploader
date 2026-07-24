import { Plugin } from "obsidian";
import { UploadModal } from "./src/modal";
import { CloudImageSettingTab } from "./src/settings";
import { DEFAULT_SETTINGS } from "./src/types";
import type { CloudImagePluginSettings, Account } from "./src/types";
import { ProviderRegistry } from "./src/providers/registry";
import { ImgBBProvider } from "./src/providers/imgbb";
import { R2Provider } from "./src/providers/r2";
import { B2Provider } from "./src/providers/b2";

export default class CloudImagePlugin extends Plugin {
  settings!: CloudImagePluginSettings;

  async onload() {
    const raw = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);

    // One-time migration: apiKey → Account
    if (raw && "apiKey" in raw) {
      const apiKey: string = (raw as any).apiKey?.trim() ?? "";
      if (apiKey) {
        const account: Account = {
          id: crypto.randomUUID(),
          name: "ImgBB",
          provider: "imgbb",
          imgbbApiKey: apiKey,
        };
        this.settings.accounts = [account];
        this.settings.lastUsedAccountId = account.id;
      }
      delete (this.settings as any).apiKey;
      await this.saveData(this.settings);
    }

    // Setup provider registry
    const registry = new ProviderRegistry();
    registry.register(new ImgBBProvider());
    registry.register(new R2Provider());
    registry.register(new B2Provider());

    this.addSettingTab(new CloudImageSettingTab(this.app, this, registry));

    this.addCommand({
      id: "cloudimage-upload",
      name: "CloudImage: Upload image",
      hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "U" }],
      callback: () => {
        new UploadModal(this.app, this, registry).open();
      },
    });
  }
}
