import { App, Notice, PluginSettingTab } from "obsidian";
import type CloudImagePlugin from "../main";
import type { Account } from "./types";
import type { ProviderRegistry } from "./providers/registry";

// ── helpers ────────────────────────────────────────────────────────

function extractCredentials(account: Account): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(account)) {
    if (typeof value === "string" && key !== "id" && key !== "name" && key !== "provider") {
      fields[key] = value;
    }
  }
  return fields;
}

const PROVIDER_REQUIRED_FIELDS: Record<string, string[]> = {
  imgbb: ["imgbbApiKey"],
  r2: ["r2AccountId", "r2AccessKeyId", "r2SecretAccessKey", "r2Bucket"],
  b2: ["b2ApplicationKeyId", "b2ApplicationKey", "b2BucketId", "b2BucketName"],
};

function validateAccount(account: Partial<Account>, provider: string): string | null {
  const required = PROVIDER_REQUIRED_FIELDS[provider] ?? [];
  for (const field of required) {
    if (!(account as any)[field]?.trim()) {
      return `${field} is required`;
    }
  }
  return null;
}

const PROVIDER_FIELD_LABELS: Record<string, Record<string, string>> = {
  imgbb: {
    imgbbApiKey: "API Key",
  },
  r2: {
    r2AccountId: "Account ID",
    r2AccessKeyId: "Access Key ID",
    r2SecretAccessKey: "Secret Access Key",
    r2Bucket: "Bucket",
    r2CustomDomain: "Custom Domain (optional)",
  },
  b2: {
    b2ApplicationKeyId: "Application Key ID",
    b2ApplicationKey: "Application Key",
    b2BucketId: "Bucket ID",
    b2BucketName: "Bucket Name",
  },
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  imgbb: "ImgBB",
  r2: "Cloudflare R2",
  b2: "Backblaze B2",
};

// ── Settings Tab ───────────────────────────────────────────────────

export class CloudImageSettingTab extends PluginSettingTab {
  plugin: CloudImagePlugin;
  private registry: ProviderRegistry;

  // per-tab state
  private showingAddForm = false;
  private editingAccountId: string | null = null;

  constructor(app: App, plugin: CloudImagePlugin, registry: ProviderRegistry) {
    super(app, plugin);
    this.plugin = plugin;
    this.registry = registry;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const accounts = this.plugin.settings.accounts;

    // ── CORS help note ──────────────────────────────────────────
    const corsNote = containerEl.createDiv("cloudimage-cors-note");
    corsNote.createEl("p", {
      text: "Desktop (Electron) has relaxed CORS enforcement. On mobile (WebView), R2 and B2 require CORS configuration in the provider dashboard. See the plugin README for details.",
    });

    // ── Account list ────────────────────────────────────────────
    const listContainer = containerEl.createDiv("cloudimage-account-list");

    if (accounts.length === 0 && !this.showingAddForm) {
      this.renderEmptyState(listContainer);
    } else {
      for (const account of accounts) {
        if (this.editingAccountId === account.id) {
          this.renderInlineEditForm(listContainer, account);
        } else {
          this.renderAccountCard(listContainer, account);
        }
      }
    }

    // ── Add Account section ──────────────────────────────────────
    if (this.showingAddForm) {
      this.renderAddForm(containerEl.createDiv("cloudimage-account-form"));
    } else {
      this.renderAddButton(containerEl);
    }
  }

  // ── Empty State ────────────────────────────────────────────────

  private renderEmptyState(container: HTMLElement): void {
    const empty = container.createDiv("cloudimage-account-empty");
    empty.createEl("p", {
      text: "No upload accounts configured. Add one to start uploading images.",
    });
  }

  // ── Add Button ─────────────────────────────────────────────────

  private renderAddButton(container: HTMLElement): void {
    const btn = container.createEl("button", {
      text: "+ Add Account",
      cls: "cloudimage-add-btn",
    });
    btn.addEventListener("click", () => {
      this.showingAddForm = true;
      this.display();
    });
  }

  // ── Add Form ───────────────────────────────────────────────────

  private renderAddForm(container: HTMLElement): void {
    container.empty();
    container.createEl("h3", { text: "Add Account" });

    let selectedProvider = "imgbb";

    // Provider picker
    const pickerRow = container.createDiv("cloudimage-provider-picker");
    for (const pid of ["imgbb", "r2", "b2"]) {
      const btn = pickerRow.createEl("button", {
        text: PROVIDER_DISPLAY_NAMES[pid],
        cls: `cloudimage-provider-btn ${pid === selectedProvider ? "cloudimage-provider-btn--active" : ""}`,
      });
      btn.addEventListener("click", () => {
        selectedProvider = pid;
        pickerRow.querySelectorAll(".cloudimage-provider-btn").forEach((b) =>
          b.removeClass("cloudimage-provider-btn--active"),
        );
        btn.addClass("cloudimage-provider-btn--active");
        credsContainer.empty();
        this.renderProviderFields(credsContainer, pid, {});
      });
    }

    // Credential fields
    const credsContainer = container.createDiv("cloudimage-credential-fields");
    this.renderProviderFields(credsContainer, selectedProvider, {});

    // Account name
    const nameContainer = container.createDiv("cloudimage-form-field");
    nameContainer.createEl("label", {
      text: "Account Name",
      attr: { for: "cloudimage-account-name" },
    });
    const nameInput = nameContainer.createEl("input", {
      type: "text",
      cls: "cloudimage-form-input",
      attr: {
        id: "cloudimage-account-name",
        placeholder: PROVIDER_DISPLAY_NAMES[selectedProvider],
      },
    });

    // ── Compression section ──────────────────────────────────────
    const compressionToggle = container.createEl("div", { cls: "cloudimage-compression-toggle" });
    const compressionCheckbox = compressionToggle.createEl("input", {
      type: "checkbox",
      attr: { id: "cloudimage-compression-add" },
    }) as HTMLInputElement;
    compressionToggle.createEl("label", {
      text: " Enable image compression",
      attr: { for: "cloudimage-compression-add" },
    });

    const compressionFields = container.createDiv("cloudimage-compression-fields");
    compressionFields.style.display = "none";

    const compMaxWidthRow = compressionFields.createDiv("cloudimage-form-field");
    compMaxWidthRow.createEl("label", { text: "Max Width (px)" });
    const compMaxWidthInput = compMaxWidthRow.createEl("input", {
      type: "number",
      cls: "cloudimage-form-input",
      attr: { value: "1920", min: "400", max: "4000", step: "100" },
    }) as HTMLInputElement;

    const compFormatRow = compressionFields.createDiv("cloudimage-form-field");
    compFormatRow.createEl("label", { text: "Format" });
    const compFormatSelect = compFormatRow.createEl("select", { cls: "dropdown" }) as HTMLSelectElement;
    const webpOpt = compFormatSelect.createEl("option", { text: "WebP (recommended)" });
    webpOpt.value = "webp";
    const origOpt = compFormatSelect.createEl("option", { text: "Original" });
    origOpt.value = "original";

    const compQualityRow = compressionFields.createDiv("cloudimage-form-field");
    compQualityRow.createEl("label", { text: "Quality" });
    const compQualityInput = compQualityRow.createEl("input", {
      type: "number",
      cls: "cloudimage-form-input",
      attr: { value: "85", min: "50", max: "100", step: "5" },
    }) as HTMLInputElement;

    compressionCheckbox.addEventListener("change", () => {
      compressionFields.style.display = compressionCheckbox.checked ? "block" : "none";
    });

    // Collect inputs
    const getCredentialInputs = (): HTMLInputElement[] =>
      Array.from(credsContainer.querySelectorAll("input.cloudimage-form-input"));

    // Actions
    const actionsRow = container.createDiv("cloudimage-form-actions");
    const saveBtn = actionsRow.createEl("button", { text: "Save", cls: "mod-cta" });
    const cancelBtn = actionsRow.createEl("button", { text: "Cancel" });

    const doSave = () => {
      const provider = selectedProvider;
      const name = nameInput.value.trim() || PROVIDER_DISPLAY_NAMES[provider];

      const partial: Record<string, string> = { name, provider };
      const fieldDefs = PROVIDER_FIELD_LABELS[provider];
      const inputs = getCredentialInputs();
      const fieldKeys = Object.keys(fieldDefs);
      for (let i = 0; i < fieldKeys.length; i++) {
        const val = inputs[i]?.value.trim();
        if (val) partial[fieldKeys[i]] = val;
      }

      const error = validateAccount(partial as Partial<Account>, provider);
      if (error) {
        new Notice(error);
        return;
      }

      const account: Account = {
        id: crypto.randomUUID(),
        name,
        provider: provider as Account["provider"],
      };
      for (const [k, v] of Object.entries(partial)) {
        if (k !== "name" && k !== "provider" && v) {
          (account as any)[k] = v;
        }
      }

      // Compression
      if (compressionCheckbox.checked) {
        (account as any).compressionEnabled = true;
        (account as any).compressionMaxWidth = parseInt(compMaxWidthInput.value) || 1920;
        (account as any).compressionFormat = compFormatSelect.value;
        (account as any).compressionQuality = parseInt(compQualityInput.value) || 85;
        (account as any).compressionSkipThresholdKB = 100;
      }

      this.plugin.settings.accounts.push(account);
      this.plugin.saveData(this.plugin.settings);
      this.showingAddForm = false;
      this.display();
    };

    saveBtn.addEventListener("click", doSave);
    cancelBtn.addEventListener("click", () => {
      this.showingAddForm = false;
      this.display();
    });
  }

  // ── Provider Fields ─────────────────────────────────────────────

  private renderProviderFields(
    container: HTMLElement,
    provider: string,
    values: Record<string, string>,
  ): void {
    container.empty();
    const labels = PROVIDER_FIELD_LABELS[provider];
    if (!labels) return;

    const isSecret = (key: string): boolean =>
      ["apiKey", "SecretAccessKey", "ApplicationKey", "imgbbApiKey", "r2SecretAccessKey", "b2ApplicationKey"].some(
        (s) => key.toLowerCase().includes(s.toLowerCase()),
      );

    for (const [field, label] of Object.entries(labels)) {
      const fieldContainer = container.createDiv("cloudimage-form-field");
      fieldContainer.createEl("label", {
        text: label,
        attr: { for: `cloudimage-field-${field}` },
      });

      const input = fieldContainer.createEl("input", {
        type: isSecret(field) ? "password" : "text",
        cls: "cloudimage-form-input",
        attr: {
          id: `cloudimage-field-${field}`,
          value: values[field] ?? "",
        },
      });

      if (isSecret(field)) {
        const revealBtn = fieldContainer.createEl("button", {
          text: "👁",
          cls: "cloudimage-reveal-btn",
          attr: { title: "Show" },
        });
        revealBtn.addEventListener("click", () => {
          const isPassword = input.type === "password";
          input.type = isPassword ? "text" : "password";
          revealBtn.textContent = isPassword ? "🙈" : "👁";
          revealBtn.setAttribute("title", isPassword ? "Hide" : "Show");
        });
      }
    }
  }

  // ── Account Card ───────────────────────────────────────────────

  private renderAccountCard(container: HTMLElement, account: Account): void {
    const card = container.createDiv("cloudimage-account-card");

    const header = card.createDiv("cloudimage-account-header");
    header.createEl("strong", { text: account.name });
    header.createSpan({
      text: PROVIDER_DISPLAY_NAMES[account.provider] ?? account.provider,
      cls: `cloudimage-provider-badge cloudimage-provider-badge--${account.provider}`,
    });

    const info = card.createDiv("cloudimage-account-info");
    info.setText(this.getAccountKeyInfo(account));

    const actions = card.createDiv("cloudimage-account-actions");
    const editBtn = actions.createEl("button", { text: "Edit" });
    const deleteBtn = actions.createEl("button", { text: "Delete" });
    const testBtn = actions.createEl("button", { text: "Test Connection" });

    editBtn.addEventListener("click", () => {
      this.editingAccountId = account.id;
      this.display();
    });

    deleteBtn.addEventListener("click", () => {
      this.renderDeleteConfirmation(card, account);
    });

    testBtn.addEventListener("click", async () => {
      const oldStatus = card.querySelector(".cloudimage-test-status");
      if (oldStatus) oldStatus.remove();

      testBtn.disabled = true;
      testBtn.textContent = "Testing…";

      const provider = this.registry.get(account.provider);
      let result: { ok: boolean; message?: string };
      if (!provider) {
        result = { ok: false, message: `Provider '${account.provider}' is not available.` };
      } else {
        result = await provider.testConnection(extractCredentials(account));
      }

      const statusEl = card.createDiv("cloudimage-test-status");
      if (result.ok) {
        statusEl.setText("✅ Connection successful");
        statusEl.addClass("cloudimage-test-status--success");
      } else {
        statusEl.setText(`❌ ${result.message ?? "Connection failed"}`);
        statusEl.addClass("cloudimage-test-status--fail");
      }

      testBtn.disabled = false;
      testBtn.textContent = "Test Connection";
    });
  }

  // ── Delete Confirmation ────────────────────────────────────────

  private renderDeleteConfirmation(card: HTMLElement, account: Account): void {
    card.empty();
    card.addClass("cloudimage-delete-confirmation");
    card.createEl("p", { text: `Delete account '${account.name}'?` });

    const actions = card.createDiv("cloudimage-account-actions");
    const cancelBtn = actions.createEl("button", { text: "Cancel" });
    const confirmBtn = actions.createEl("button", { text: "Delete", cls: "mod-warning" });

    cancelBtn.addEventListener("click", () => {
      card.removeClass("cloudimage-delete-confirmation");
      this.display();
    });

    confirmBtn.addEventListener("click", () => {
      const accounts = this.plugin.settings.accounts;
      const idx = accounts.findIndex((a) => a.id === account.id);
      if (idx !== -1) {
        accounts.splice(idx, 1);
      }
      if (this.plugin.settings.lastUsedAccountId === account.id) {
        this.plugin.settings.lastUsedAccountId = accounts[0]?.id ?? null;
      }
      this.plugin.saveData(this.plugin.settings);
      this.display();
    });
  }

  // ── Inline Edit Form ────────────────────────────────────────────

  private renderInlineEditForm(container: HTMLElement, account: Account): void {
    const card = container.createDiv("cloudimage-account-card cloudimage-account-card--editing");

    const providerRow = card.createDiv("cloudimage-form-field");
    providerRow.createEl("label", { text: "Provider" });
    providerRow.createEl("input", {
      type: "text",
      cls: "cloudimage-form-input",
      attr: {
        value: PROVIDER_DISPLAY_NAMES[account.provider] ?? account.provider,
        disabled: "true",
        readonly: "true",
      },
    });

    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(account)) {
      if (typeof v === "string" && k !== "id" && k !== "provider") {
        values[k] = v;
      }
    }

    const credsContainer = card.createDiv("cloudimage-credential-fields");
    this.renderProviderFields(credsContainer, account.provider, values);

    const nameContainer = card.createDiv("cloudimage-form-field");
    nameContainer.createEl("label", {
      text: "Account Name",
      attr: { for: "cloudimage-edit-name" },
    });
    const nameInput = nameContainer.createEl("input", {
      type: "text",
      cls: "cloudimage-form-input",
      attr: { id: "cloudimage-edit-name", value: account.name },
    });

    // ── Compression (edit mode) ────────────────────────────────────
    const compToggle = card.createEl("div", { cls: "cloudimage-compression-toggle" });
    const compCheckbox = compToggle.createEl("input", {
      type: "checkbox",
      attr: { id: "cloudimage-compression-edit" },
    }) as HTMLInputElement;
    if (account.compressionEnabled) compCheckbox.checked = true;
    compToggle.createEl("label", {
      text: " Enable image compression",
      attr: { for: "cloudimage-compression-edit" },
    });

    const compFields = card.createDiv("cloudimage-compression-fields");
    compFields.style.display = account.compressionEnabled ? "block" : "none";

    const compMaxWidthRow = compFields.createDiv("cloudimage-form-field");
    compMaxWidthRow.createEl("label", { text: "Max Width (px)" });
    const compMaxWidthInput = compMaxWidthRow.createEl("input", {
      type: "number",
      cls: "cloudimage-form-input",
      attr: { value: String(account.compressionMaxWidth ?? 1920), min: "400", max: "4000", step: "100" },
    }) as HTMLInputElement;

    const compFormatRow = compFields.createDiv("cloudimage-form-field");
    compFormatRow.createEl("label", { text: "Format" });
    const compFormatSelect = compFormatRow.createEl("select", { cls: "dropdown" }) as HTMLSelectElement;
    const eWebpOpt = compFormatSelect.createEl("option", { text: "WebP (recommended)" });
    eWebpOpt.value = "webp";
    const eOrigOpt = compFormatSelect.createEl("option", { text: "Original" });
    eOrigOpt.value = "original";
    if ((account.compressionFormat ?? "webp") === "webp") eWebpOpt.selected = true;
    else eOrigOpt.selected = true;

    const compQualityRow = compFields.createDiv("cloudimage-form-field");
    compQualityRow.createEl("label", { text: "Quality" });
    const compQualityInput = compQualityRow.createEl("input", {
      type: "number",
      cls: "cloudimage-form-input",
      attr: { value: String(account.compressionQuality ?? 85), min: "50", max: "100", step: "5" },
    }) as HTMLInputElement;

    compCheckbox.addEventListener("change", () => {
      compFields.style.display = compCheckbox.checked ? "block" : "none";
    });

    // Actions
    const actionsRow = card.createDiv("cloudimage-form-actions");
    const saveBtn = actionsRow.createEl("button", { text: "Save", cls: "mod-cta" });
    const cancelBtn = actionsRow.createEl("button", { text: "Cancel" });

    const getCredentialInputs = (): HTMLInputElement[] =>
      Array.from(credsContainer.querySelectorAll("input.cloudimage-form-input"));

    saveBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        new Notice("Account name is required");
        return;
      }

      const updated: Account = { ...account, name };
      const fieldKeys = Object.keys(PROVIDER_FIELD_LABELS[account.provider] ?? {});
      const inputs = getCredentialInputs();
      for (let i = 0; i < fieldKeys.length; i++) {
        const val = inputs[i]?.value.trim();
        (updated as any)[fieldKeys[i]] = val || undefined;
      }

      // Compression
      if (compCheckbox.checked) {
        (updated as any).compressionEnabled = true;
        (updated as any).compressionMaxWidth = parseInt(compMaxWidthInput.value) || 1920;
        (updated as any).compressionFormat = compFormatSelect.value;
        (updated as any).compressionQuality = parseInt(compQualityInput.value) || 85;
        (updated as any).compressionSkipThresholdKB = 100;
      } else {
        (updated as any).compressionEnabled = false;
      }

      const error = validateAccount(updated as Partial<Account>, account.provider);
      if (error) {
        new Notice(error);
        return;
      }

      const accounts = this.plugin.settings.accounts;
      const idx = accounts.findIndex((a) => a.id === account.id);
      if (idx !== -1) accounts[idx] = updated;

      this.plugin.saveData(this.plugin.settings);
      this.editingAccountId = null;
      this.display();
    });

    cancelBtn.addEventListener("click", () => {
      this.editingAccountId = null;
      this.display();
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private getAccountKeyInfo(account: Account): string {
    switch (account.provider) {
      case "imgbb":
        return "api.imgbb.com";
      case "r2":
        return account.r2Bucket ?? "—";
      case "b2":
        return account.b2BucketName ?? "—";
      default:
        return "";
    }
  }
}
