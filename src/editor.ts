import { Editor } from "obsidian";

export class EditorService {
  /**
   * Insert markdown image syntax at cursor position.
   * Supports optional size: ![name|size](url) or ![name](url)
   */
  static insertAtCursor(
    editor: Editor,
    url: string,
    filename: string,
    size?: number,
  ): void {
    const alt = filename ? filename.replace(/\.[^.]+$/, "") : "image";
    const markdown = size ? `![${alt}|${size}](${url})` : `![${alt}](${url})`;
    const cursor = editor.getCursor();
    editor.replaceRange(markdown, cursor);
    editor.setCursor({ line: cursor.line, ch: cursor.ch + markdown.length });
  }

  /**
   * Insert raw URL at cursor position (no markdown wrapping).
   * Used for Excalidraw and similar plugins that need plain URLs.
   */
  static insertRawUrl(editor: Editor, url: string): void {
    const cursor = editor.getCursor();
    editor.replaceRange(url, cursor);
    editor.setCursor({ line: cursor.line, ch: cursor.ch + url.length });
  }
}
