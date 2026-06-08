import { App, Modal, Notice } from "obsidian";
import { ImgBBClient, ImgBBError } from "./api";
import { EditorService } from "./editor";
import type CloudImagePlugin from "../main";
import type { UploadedImage } from "./types";

export class UploadModal extends Modal {
  plugin: CloudImagePlugin;
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  private dropZoneEl!: HTMLElement;
  private previewSection!: HTMLElement;
  private previewEl!: HTMLImageElement;
  private uploadBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private fileInfoEl!: HTMLElement;
  private urlInputEl!: HTMLInputElement;
  private nameInputEl!: HTMLInputElement;
  private pasteHandler!: (e: ClipboardEvent) => void;

  constructor(app: App, plugin: CloudImagePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cloudimage-modal");

    contentEl.createEl("h2", { text: "CloudImage Uploader" });

    // Drop zone — unified: drop, paste, click
    this.dropZoneEl = contentEl.createDiv("cloudimage-dropzone");
    this.dropZoneEl.createEl("p", {
      text: "Drop, paste (Ctrl+V), or click to browse",
    });

    // Hidden file input
    const fileInput = contentEl.createEl("input", {
      type: "file",
      attr: { accept: "image/*" },
    });
    fileInput.style.display = "none";

    this.dropZoneEl.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) this.handleFile(file);
    });

    // Drag handlers
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

    // Clipboard paste
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
        this.insertImageUrl(text);
      }
    };
    document.addEventListener("paste", this.pasteHandler, { capture: true });

    // URL line — compact inline row
    const urlRow = contentEl.createDiv("cloudimage-url-row");
    urlRow.createSpan({ text: "\u{1F517}", cls: "cloudimage-url-icon" });
    this.urlInputEl = urlRow.createEl("input", {
      type: "text",
      placeholder: "Paste image URL\u2026",
      cls: "cloudimage-url-input",
    });
    const urlBtn = urlRow.createEl("button", {
      text: "\u2192",
      cls: "cloudimage-url-btn",
    });
    urlBtn.addEventListener("click", () => {
      const url = this.urlInputEl.value.trim();
      if (!url) {
        new Notice("Please enter an image URL");
        return;
      }
      this.insertImageUrl(url);
    });

    // Preview section — hidden until file selected
    this.previewSection = contentEl.createDiv("cloudimage-preview-section");
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

    // Status
    this.statusEl = contentEl.createEl("p", { cls: "cloudimage-status" });

    // Buttons
    const buttonRow = contentEl.createDiv("cloudimage-buttons");
    this.cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    this.cancelBtn.addEventListener("click", () => this.close());
    this.uploadBtn = buttonRow.createEl("button", {
      text: "Upload \u2B06",
      cls: "mod-cta",
    });
    this.uploadBtn.disabled = true;
    this.uploadBtn.addEventListener("click", () => this.handleUpload());

    // History — collapsible
    this.renderHistory(contentEl);

    // Escape
    this.scope.register([], "Escape", () => {
      this.close();
      return false;
    });
  }

  // ── Image selection ──────────────────────────────────────

  handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      new Notice("Please select an image file");
      return;
    }

    this.selectedFile = file;
    this.uploadBtn.disabled = false;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    this.nameInputEl.value = baseName;

    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    this.previewEl.src = this.previewUrl;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    this.fileInfoEl.textContent = `${file.name} \u00B7 ${sizeMB} MB`;

    this.previewSection.style.display = "block";
  }

  // ── Upload flow ───────────────────────────────────────────

  async handleUpload() {
    if (!this.selectedFile) return;

    const file = this.selectedFile;
    const apiKey = this.plugin.settings.apiKey;
    const customName =
      this.nameInputEl.value.trim() || file.name.replace(/\.[^.]+$/, "");

    if (!apiKey) {
      new Notice("Please configure your ImgBB API key in settings");
      return;
    }

    this.setLoading(true);

    try {
      const result = await ImgBBClient.upload(file, apiKey, customName);
      const editor = this.app.workspace.activeEditor?.editor;

      this.saveToHistory({
        url: result.url,
        displayUrl: result.displayUrl,
        deleteUrl: result.deleteUrl,
        filename: customName,
        uploadedAt: Date.now(),
      });

      if (editor) {
        EditorService.insertAtCursor(editor, result.url, customName);
        new Notice("Image uploaded successfully");
      } else {
        new Notice(`Image uploaded: ${result.url}`);
      }

      this.close();
    } catch (error) {
      if (error instanceof ImgBBError) {
        new Notice(error.message);
      } else {
        new Notice("Upload failed: unexpected error");
      }
      this.setLoading(false);
    }
  }

  private setLoading(loading: boolean) {
    this.uploadBtn.disabled = loading;
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

  // ── URL helpers ───────────────────────────────────────────

  private isImageUrl(text: string): boolean {
    try {
      const url = new URL(text);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      return /\.(png|jpe?g|gif|webp|bmp|svg|ico)(\?.*)?$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  private insertImageUrl(url: string) {
    const editor = this.app.workspace.activeEditor?.editor;
    const filename = url.split("/").pop()?.split("?")[0] || "image";

    this.saveToHistory({
      url,
      displayUrl: url,
      deleteUrl: "",
      filename,
      uploadedAt: Date.now(),
    });

    if (editor) {
      EditorService.insertAtCursor(editor, url, filename);
      new Notice("Image inserted from URL");
    } else {
      new Notice(`Image URL: ${url}`);
    }

    this.close();
  }

  // ── History ───────────────────────────────────────────────

  private saveToHistory(entry: UploadedImage) {
    this.plugin.settings.uploadedImages =
      this.plugin.settings.uploadedImages.filter(
        (img) => img.url !== entry.url,
      );
    this.plugin.settings.uploadedImages.unshift(entry);
    if (this.plugin.settings.uploadedImages.length > 50) {
      this.plugin.settings.uploadedImages.length = 50;
    }
    this.plugin.saveData(this.plugin.settings);
  }

  private renderHistory(container: HTMLElement) {
    const images = this.plugin.settings.uploadedImages;
    if (images.length === 0) return;

    const section = container.createDiv("cloudimage-history");

    // Toggle header
    const historyToggle = section.createEl("p", {
      text: `\u25B8 History (${images.length})`,
      cls: "cloudimage-history-toggle",
    });
    const historyContent = section.createDiv("cloudimage-history-content");
    historyContent.style.display = "none";

    const searchInput = historyContent.createEl("input", {
      type: "text",
      placeholder: "Search by name\u2026",
      cls: "cloudimage-history-search",
    });
    const historyGrid = historyContent.createDiv(
      "cloudimage-history-grid",
    );

    const renderGrid = (query: string) => {
      historyGrid.empty();
      const q = query.toLowerCase().trim();
      const filtered = q
        ? images.filter((img) => img.filename.toLowerCase().includes(q))
        : images;
      const shown = filtered.length > 20 ? filtered.slice(0, 20) : filtered;

      for (const img of shown) {
        const card = historyGrid.createDiv("cloudimage-history-card");
        const thumb = card.createEl("img", {
          cls: "cloudimage-history-thumb",
          attr: { src: img.url, loading: "lazy", title: img.filename },
        });
        thumb.addEventListener("click", () => {
          const editor = this.app.workspace.activeEditor?.editor;
          if (editor) {
            EditorService.insertAtCursor(editor, img.url, img.filename);
            new Notice("Image inserted");
          } else {
            new Notice(`Image URL: ${img.url}`);
          }
          this.close();
        });
        thumb.addEventListener("error", () => {
          card.addClass("cloudimage-history-card--broken");
          thumb.remove();
        });
      }

      if (shown.length === 0 && q) {
        historyGrid.createEl("p", {
          text: `No matches for "${query}"`,
          cls: "cloudimage-history-empty",
        });
      } else if (filtered.length > 20) {
        historyGrid.createEl("p", {
          text: `Showing 20 of ${filtered.length} \u2014 search to narrow`,
          cls: "cloudimage-history-empty",
        });
      }
    };

    historyToggle.addEventListener("click", () => {
      const open = historyContent.style.display !== "none";
      historyContent.style.display = open ? "none" : "block";
      historyToggle.textContent = open
        ? `\u25B8 History (${images.length})`
        : `\u25BE History (${images.length})`;
    });

    searchInput.addEventListener("input", () => renderGrid(searchInput.value));
    renderGrid(searchInput.value);
  }

  // ── Cleanup ───────────────────────────────────────────────

  onClose() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    document.removeEventListener("paste", this.pasteHandler, { capture: true });
    this.contentEl.empty();
  }
}
