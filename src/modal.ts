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
  private previewEl!: HTMLImageElement;
  private uploadBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private fileInfoEl!: HTMLElement;
  private urlInputEl!: HTMLInputElement;
  private pasteHandler!: (e: ClipboardEvent) => void;

  constructor(app: App, plugin: CloudImagePlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cloudimage-modal");

    contentEl.createEl("h2", { text: "Upload Image to ImgBB" });

    // Drop zone
    this.dropZoneEl = contentEl.createDiv("cloudimage-dropzone");
    this.dropZoneEl.createEl("p", {
      text: "Drop an image here, paste from clipboard, or click to browse",
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

    // Clipboard paste — capture images and image URLs
    this.pasteHandler = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;

      // Check for image file first
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

      // Check for image URL in text
      const text = data.getData("text/plain")?.trim();
      if (text && this.isImageUrl(text)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.insertImageUrl(text);
      }
    };
    document.addEventListener("paste", this.pasteHandler, { capture: true });

    // Paste button — fallback using Clipboard API
    const pasteBtn = contentEl.createEl("button", {
      text: "\u{1F4CB} Paste from clipboard",
      cls: "cloudimage-paste-btn",
    });
    pasteBtn.addEventListener("click", async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageTypes = item.types.filter((t) => t.startsWith("image/"));
          if (imageTypes.length > 0) {
            const blob = await item.getType(imageTypes[0]);
            const file = new File([blob], "clipboard.png", {
              type: imageTypes[0],
            });
            this.handleFile(file);
            return;
          }
        }
        new Notice("No image found in clipboard");
      } catch {
        new Notice(
          "Clipboard access denied — use Ctrl+V or drag & drop instead",
        );
      }
    });

    // URL input section — insert image URL directly without upload
    const urlSection = contentEl.createDiv("cloudimage-url-section");
    urlSection.createEl("p", {
      text: "\u2014 or paste an image URL \u2014",
      cls: "cloudimage-separator",
    });
    const urlRow = urlSection.createDiv("cloudimage-url-row");
    this.urlInputEl = urlRow.createEl("input", {
      type: "text",
      placeholder: "https://example.com/image.png",
      cls: "cloudimage-url-input",
    });
    const insertUrlBtn = urlRow.createEl("button", {
      text: "Insert",
      cls: "cloudimage-url-btn",
    });
    insertUrlBtn.addEventListener("click", () => {
      const url = this.urlInputEl.value.trim();
      if (!url) {
        new Notice("Please enter an image URL");
        return;
      }
      this.insertImageUrl(url);
    });

    // Recent uploads history
    this.renderHistory(contentEl);

    // Preview image
    this.previewEl = contentEl.createEl("img", {
      cls: "cloudimage-preview",
    });
    this.previewEl.style.display = "none";

    // File info
    this.fileInfoEl = contentEl.createEl("p", {
      cls: "cloudimage-fileinfo",
    });

    // Status text
    this.statusEl = contentEl.createEl("p", { cls: "cloudimage-status" });

    // Buttons
    const buttonRow = contentEl.createDiv("cloudimage-buttons");

    this.cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    this.cancelBtn.addEventListener("click", () => this.close());

    this.uploadBtn = buttonRow.createEl("button", {
      text: "Upload",
      cls: "mod-cta",
    });
    this.uploadBtn.disabled = true;
    this.uploadBtn.addEventListener("click", () => this.handleUpload());

    // Escape key closes modal
    this.scope.register([], "Escape", () => {
      this.close();
      return false;
    });
  }

  handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      new Notice("Please select an image file");
      return;
    }

    this.selectedFile = file;
    this.uploadBtn.disabled = false;

    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(file);
    this.previewEl.src = this.previewUrl;
    this.previewEl.style.display = "block";

    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    this.fileInfoEl.textContent = `${file.name} (${sizeMB} MB)`;
  }

  async handleUpload() {
    if (!this.selectedFile) return;

    const file = this.selectedFile;
    const apiKey = this.plugin.settings.apiKey;

    if (!apiKey) {
      new Notice("Please configure your ImgBB API key in settings");
      return;
    }

    this.setLoading(true);

    try {
      const result = await ImgBBClient.upload(file, apiKey);
      const editor = this.app.workspace.activeEditor?.editor;

      this.saveToHistory({
        url: result.url,
        displayUrl: result.displayUrl,
        deleteUrl: result.deleteUrl,
        filename: file.name,
        uploadedAt: Date.now(),
      });

      if (editor) {
        EditorService.insertAtCursor(editor, result.url, file.name);
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

  private saveToHistory(entry: UploadedImage) {
    // Deduplicate — remove existing entry with same URL
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
    section.createEl("p", {
      text: "\u2014 Recent uploads \u2014",
      cls: "cloudimage-separator",
    });

    const grid = section.createDiv("cloudimage-history-grid");
    const recent = images.slice(0, 10);

    for (const img of recent) {
      const card = grid.createDiv("cloudimage-history-card");
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
  }

  onClose() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }
    document.removeEventListener("paste", this.pasteHandler, { capture: true });
    this.contentEl.empty();
  }
}
