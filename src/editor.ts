import { Editor } from "obsidian";

export class EditorService {
  static insertAtCursor(editor: Editor, url: string, filename: string, size?: number): void {
    const alt = filename
      ? filename.replace(/\.[^.]+$/, "")
      : "image";
    const markdown = size
      ? `![${alt}|${size}](${url})`
      : `![${alt}](${url})`;
    const cursor = editor.getCursor();
    editor.replaceRange(markdown, cursor);
    const newPos = { line: cursor.line, ch: cursor.ch + markdown.length };
    editor.setCursor(newPos);
  }

  /** Insert only the raw URL — no markdown wrapping. Useful for Excalidraw and other non-markdown contexts. */
  static insertRawUrl(editor: Editor, url: string): void {
    const cursor = editor.getCursor();
    editor.replaceRange(url, cursor);
    const newPos = { line: cursor.line, ch: cursor.ch + url.length };
    editor.setCursor(newPos);
  }
}
