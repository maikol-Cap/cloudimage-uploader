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
}
