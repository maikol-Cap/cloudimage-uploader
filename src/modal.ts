import { App, Modal, Notice } from "obsidian";
import { ImgBBClient, ImgBBError } from "./api";
import { EditorService } from "./editor";
import type CloudImagePlugin from "../main";
import type { UploadedImage } from "./types";
import {
  SIZE_PRESETS,
  MAX_HISTORY,
  MAX_HISTORY_DISPLAY,
} from "./types";

type InsertMode = "markdown" | "raw";

export class UploadModal extends Modal {
  plugin: CloudImagePlugin;

  // State
  private selectedFile: File | null = null;
  private selectedUrl: string | null = null;
  private previewUrl: string | null = null;
  private selectedSize = "none";

  // UI elements
  private dropZoneEl!: HTMLElement;
  private previewSection!: HTMLElement;
  private previewEl!: HTMLImageElement;
  private fileInfoEl!: HTMLElement;
  private nameInputEl!: HTMLInputElement;
  private sizeSelectEl!: HTMLSelectElement;
  private customRowEl!: HTMLElement;
  private customInputEl!: HTMLInputElement;
  private urlInputEl!: HTMLInputElement;
  private uploadBtn!: HTMLButtonElement;
  private urlBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private pasteHandler!: (e: ClipboardEvent) => void;

  constructor(app: App, plugin: CloudImagePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cloudimage-modal");

    this.renderTitle(contentEl);
    this.renderSizeControls(contentEl);
    this.renderDropZone(contentEl);
    this.renderUrlInput(contentEl);
    this.renderPreview(contentEl);
    this.renderStatus(contentEl);
    this.renderButtons(contentEl);
    this.renderHistory(contentEl);

    this.scope.register([], "Escape", () => {
      this.close();
      return false;
    });
  }

  onClose() {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    document.removeEventListener("paste", this.pasteHandler, { capture: true });
    this.contentEl.empty();
  }

  // ── UI Rendering ──────────────────────────────────────────────────────

  private renderTitle(container: HTMLElement): void {
    container.createDiv({ text: "Image upload", cls: "cloudimage-modal-title" });
  }

  private renderSizeControls(container: HTMLElement): void {
    const toolbar = container.createDiv("cloudimage-toolbar");

    this.sizeSelectEl = toolbar.createEl("select", {
      cls: "cloudimage-size-select",
    });

    const presets = [
      { preset: "none", label: "Original" },
      { preset: "small", label: "Small (400px)" },
      { preset: "medium", label: "Medium (600px)" },
      { preset: "full", label: "Full (800px)" },
      { preset: "custom", label: "Custom\u2026" },
    ];

    for (const { preset, label } of presets) {
      const opt = this.sizeSelectEl.createEl("option", { text: label });
      opt.value = preset;
      if (preset === this.selectedSize) opt.selected = true;
    }

    this.sizeSelectEl.addEventListener("change", () => {
      this.selectedSize = this.sizeSelectEl.value;
      this.customRowEl.style.display =
        this.selectedSize === "custom" ? "flex" : "none";
      if (this.selectedSize !== "custom") this.customInputEl.value = "";
    });

    this.customRowEl = container.createDiv("cloudimage-custom-row");
    this.customRowEl.style.display = "none";
    this.customRowEl.createSpan({ text: "Width (px):" });
    this.customInputEl = this.customRowEl.createEl("input", {
      type: "number",
      cls: "cloudimage-custom-input",
      attr: { min: "50", max: "2000", placeholder: "50\u20132000" },
    });
  }

  private renderDropZone(container: HTMLElement): void {
    this.dropZoneEl = container.createDiv("cloudimage-dropzone");
    this.dropZoneEl.createEl("p", {
      text: "Drop, paste (Ctrl+V), or click to browse",
    });

    const fileInput = container.createEl("input", {
      type: "file",
      attr: { accept: "image/*" },
    });
    fileInput.style.display = "none";

    this.dropZoneEl.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) this.handleFile(file);
    });

    // Drag and drop
    this.dropZoneEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.dropZoneEl.addClass("cloudimage-dropzone--active");
    });
    this.dropZoneEl.addEventListener("dragleave", () => {
      this.dropZoneEl.removeClass("cloudimage-dropzone--active");
    });
    this.dropZoneEl.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dropZoneEl.removeClass("cloudimage-dropzone--active");
      const file = e.dataTransfer?.files?.[0];
      if (file?.type.startsWith("image/")) {
        this.handleFile(file);
      } else {
        new Notice("Please drop an image file");
      }
    });

    // Clipboard paste — images and image URLs
    this.pasteHandler = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;

      for (const item of data.items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const file = item.getAsFile();
          if (file) {
            this.handleFile(file);
            return;
          }
        }
      }

      const text = data.getData("text/plain")?.trim();
      if (text && this.isImageUrl(text)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.handleUrl(text);
      }
    };
    document.addEventListener("paste", this.pasteHandler, { capture: true });
  }

  private renderUrlInput(container: HTMLElement): void {
    const row = container.createDiv("cloudimage-url-row");
    row.createSpan({ text: "\u{1F517}", cls: "cloudimage-url-icon" });

    this.urlInputEl = row.createEl("input", {
      type: "text",
      placeholder: "Paste image URL\u2026",
      cls: "cloudimage-url-input",
    });

    row.createEl("button", { text: "\u2192", cls: "cloudimage-url-btn" })
      .addEventListener("click", () => {
        const url = this.urlInputEl.value.trim();
        if (!url) {
          new Notice("Please enter an image URL");
          return;
        }
        this.handleUrl(url);
      });
  }

  private renderPreview(container: HTMLElement): void {
    this.previewSection = container.createDiv("cloudimage-preview-section");
    this.previewSection.style.display = "none";

    this.previewEl = this.previewSection.createEl("img", {
      cls: "cloudimage-preview",
    });
    this.fileInfoEl = this.previewSection.createEl("p", {
      cls: "cloudimage-fileinfo",
    });
    this.nameInputEl = this.previewSection.createEl("input", {
      type: "text",
      placeholder: "Name (optional)",
      cls: "cloudimage-name-input",
    });
  }

  private renderStatus(container: HTMLElement): void {
    this.statusEl = container.createEl("p", { cls: "cloudimage-status" });
  }

  private renderButtons(container: HTMLElement): void {
    const row = container.createDiv("cloudimage-buttons");

    this.cancelBtn = row.createEl("button", { text: "Cancel" });
    this.cancelBtn.addEventListener("click", () => this.close());

    const actionGroup = row.createDiv("cloudimage-action-group");

    this.urlBtn = actionGroup.createEl("button", {
      text: "\u{1F517} URL",
      title: "Insert URL only (no markdown) \u2014 for Excalidraw",
    });
    this.urlBtn.disabled = true;
    this.urlBtn.addEventListener("click", () => this.handleInsertUrl());

    this.uploadBtn = actionGroup.createEl("button", {
      text: "Upload \u2B06",
      cls: "mod-cta",
    });
    this.uploadBtn.disabled = true;
    this.uploadBtn.addEventListener("click", () => this.handleUpload());
  }

  private renderHistory(container: HTMLElement): void {
    const images = this.plugin.settings.uploadedImages;
    if (images.length === 0) return;

    const section = container.createDiv("cloudimage-history");
    const toggle = section.createEl("p", {
      text: `\u25B8 History (${images.length})`,
      cls: "cloudimage-history-toggle",
    });
    const content = section.createDiv("cloudimage-history-content");
    content.style.display = "none";

    const search = content.createEl("input", {
      type: "text",
      placeholder: "Search by name\u2026",
      cls: "cloudimage-history-search",
    });
    const grid = content.createDiv("cloudimage-history-grid");

    const renderCards = (query: string) => {
      grid.empty();
      const term = query.toLowerCase().trim();
      const filtered = term
        ? images.filter((img) => img.filename.toLowerCase().includes(term))
        : images;
      const displayed = filtered.slice(0, MAX_HISTORY_DISPLAY);

      for (const img of displayed) {
        this.renderHistoryCard(grid, img);
      }

      if (displayed.length === 0 && term) {
        grid.createEl("p", {
          text: `No matches for "${query}"`,
          cls: "cloudimage-history-empty",
        });
      } else if (filtered.length > MAX_HISTORY_DISPLAY) {
        grid.createEl("p", {
          text: `Showing ${MAX_HISTORY_DISPLAY} of ${filtered.length} \u2014 search to narrow`,
          cls: "cloudimage-history-empty",
        });
      }
    };

    toggle.addEventListener("click", () => {
      const hidden = content.style.display === "none";
      content.style.display = hidden ? "block" : "none";
      toggle.textContent = hidden
        ? `\u25BE History (${images.length})`
        : `\u25B8 History (${images.length})`;
    });

    search.addEventListener("input", () => renderCards(search.value));
    renderCards("");
  }

  private renderHistoryCard(container: HTMLElement, img: UploadedImage): void {
    const card = container.createDiv("cloudimage-history-card");

    const thumb = card.createEl("img", {
      cls: "cloudimage-history-thumb",
      attr: { src: img.url, loading: "lazy", title: img.filename },
    });
    thumb.addEventListener("click", () => {
      this.insertUrl(img.url, img.filename, "markdown", this.getEffectiveSize() ?? undefined);
      this.close();
    });
    thumb.addEventListener("error", () => {
      card.addClass("cloudimage-history-card--broken");
      thumb.remove();
    });

    card.createEl("button", {
      cls: "cloudimage-history-urlbtn",
      attr: { title: "Insert URL only (no markdown)" },
      text: "\u{1F517}",
    }).addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.insertOrCopyUrl(img.url);
      this.close();
    });
  }

  // ── Event Handlers ────────────────────────────────────────────────────

  private handleFile(file: File): void {
    if (!file.type.startsWith("image/")) {
      new Notice("Please select an image file");
      return;
    }

    this.selectedFile = file;
    this.selectedUrl = null;

    this.uploadBtn.textContent = "Upload \u2B06";
    this.uploadBtn.disabled = false;
    this.urlBtn.disabled = false;

    this.nameInputEl.value = file.name.replace(/\.[^.]+$/, "");

    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    this.previewEl.src = this.previewUrl;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    this.fileInfoEl.textContent = `${file.name} \xB7 ${sizeMB} MB`;
    this.previewSection.style.display = "block";
  }

  private handleUrl(url: string): void {
    this.selectedUrl = url;
    this.selectedFile = null;

    const filename =
      url.split("/").pop()?.split("?")[0]?.replace(/\.[^.]+$/, "") || "image";
    this.nameInputEl.value = filename;

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.previewEl.src = url;
    this.fileInfoEl.textContent = `URL: ${new URL(url).hostname}`;
    this.previewSection.style.display = "block";

    this.uploadBtn.textContent = "Insert \u2192";
    this.uploadBtn.disabled = false;
    this.urlBtn.disabled = false;
  }

  private async handleUpload(): Promise<void> {
    const sizeError = this.validateCustomSize();
    if (sizeError) {
      new Notice(sizeError);
      return;
    }
    const size = this.getEffectiveSize() ?? undefined;

    // URL mode — no upload needed, insert as markdown
    if (this.selectedUrl) {
      const name = this.nameInputEl.value.trim();
      this.saveToHistory({
        url: this.selectedUrl,
        displayUrl: this.selectedUrl,
        deleteUrl: "",
        filename: name,
        uploadedAt: Date.now(),
      });
      this.insertUrl(this.selectedUrl, name, "markdown", size);
      this.close();
      return;
    }

    // File mode — upload then insert as markdown
    if (!this.selectedFile) return;
    const name =
      this.nameInputEl.value.trim() ||
      this.selectedFile.name.replace(/\.[^.]+$/, "");
    await this.uploadAndInsert(this.selectedFile, name, "markdown", size);
    this.close();
  }

  private async handleInsertUrl(): Promise<void> {
    // URL mode — insert raw URL directly
    if (this.selectedUrl) {
      await this.insertOrCopyUrl(this.selectedUrl);
      this.close();
      return;
    }

    // File mode — upload then insert raw URL
    if (!this.selectedFile) return;
    const name =
      this.nameInputEl.value.trim() ||
      this.selectedFile.name.replace(/\.[^.]+$/, "");
    await this.uploadAndInsert(this.selectedFile, name, "raw");
    this.close();
  }

  // ── Core Logic ────────────────────────────────────────────────────────

  /**
   * Common upload flow: validate API key, upload, save history, insert.
   * Eliminates duplication between handleUpload and handleInsertUrl.
   */
  private async uploadAndInsert(
    file: File,
    name: string,
    mode: InsertMode,
    size?: number,
  ): Promise<void> {
    const apiKey = this.plugin.settings.apiKey;
    if (!apiKey) {
      new Notice("Please configure your ImgBB API key in settings");
      return;
    }

    this.setLoading(true);

    try {
      const result = await ImgBBClient.upload(file, apiKey, name);

      this.saveToHistory({
        url: result.url,
        displayUrl: result.displayUrl,
        deleteUrl: result.deleteUrl,
        filename: name,
        uploadedAt: Date.now(),
      });

      this.insertUrl(result.url, name, mode, size);
    } catch (error) {
      if (error instanceof ImgBBError) {
        new Notice(error.message);
      } else {
        new Notice("Upload failed: unexpected error");
      }
      this.setLoading(false);
    }
  }

  /**
   * Insert URL into the active editor based on mode.
   * - markdown: ![name|size](url)
   * - raw: plain URL (for Excalidraw)
   */
  private insertUrl(
    url: string,
    name: string,
    mode: InsertMode,
    size?: number,
  ): void {
    const editor = this.app.workspace.activeEditor?.editor;

    if (mode === "raw") {
      if (editor) {
        EditorService.insertRawUrl(editor, url);
        new Notice("URL inserted");
      } else {
        navigator.clipboard.writeText(url);
        new Notice("URL copied to clipboard \u2014 paste it in the canvas");
      }
    } else {
      if (editor) {
        EditorService.insertAtCursor(editor, url, name, size);
        new Notice("Image uploaded successfully");
      } else {
        new Notice(`Image uploaded: ${url}`);
      }
    }
  }

  /**
   * Insert raw URL or copy to clipboard if no editor is active.
   * Used by the "URL only" button for Excalidraw compatibility.
   */
  private async insertOrCopyUrl(url: string): Promise<void> {
    const editor = this.app.workspace.activeEditor?.editor;
    if (editor) {
      EditorService.insertRawUrl(editor, url);
      new Notice("URL inserted");
    } else {
      await navigator.clipboard.writeText(url);
      new Notice("URL copied to clipboard \u2014 paste it in the canvas");
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private validateCustomSize(): string | null {
    if (this.selectedSize !== "custom") return null;

    const raw = this.customInputEl.value.trim();
    if (!raw) return "Please enter a custom width (50\u20132000)";

    const width = parseInt(raw, 10);
    if (isNaN(width) || width < 50 || width > 2000) {
      return "Custom width must be a number between 50 and 2000";
    }
    return null;
  }

  private getEffectiveSize(): number | null {
    if (this.selectedSize === "custom") {
      const width = parseInt(this.customInputEl.value, 10);
      return isNaN(width) ? null : width;
    }
    return SIZE_PRESETS[this.selectedSize];
  }

  private setLoading(loading: boolean): void {
    this.uploadBtn.disabled = loading;
    this.urlBtn.disabled = loading;
    this.cancelBtn.disabled = loading;
    this.dropZoneEl.style.pointerEvents = loading ? "none" : "";

    if (loading) {
      this.statusEl.textContent = "Uploading\u2026";
      this.statusEl.addClass("cloudimage-status--loading");
    } else {
      this.statusEl.textContent = "";
      this.statusEl.removeClass("cloudimage-status--loading");
    }
  }

  private isImageUrl(text: string): boolean {
    try {
      const url = new URL(text);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      return /\.(png|jpe?g|gif|webp|bmp|svg|ico)(\?.*)?$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  private saveToHistory(entry: UploadedImage): void {
    const images = this.plugin.settings.uploadedImages;
    // Deduplicate by URL
    this.plugin.settings.uploadedImages = images.filter(
      (img) => img.url !== entry.url,
    );
    this.plugin.settings.uploadedImages.unshift(entry);
    // Cap at max
    if (this.plugin.settings.uploadedImages.length > MAX_HISTORY) {
      this.plugin.settings.uploadedImages.length = MAX_HISTORY;
    }
    this.plugin.saveData(this.plugin.settings);
  }
}
