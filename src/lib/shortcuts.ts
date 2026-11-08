export function isSaveShortcut(
  event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing">
): boolean {
  return (
    !event.isComposing &&
    !event.altKey &&
    !event.shiftKey &&
    (event.ctrlKey || event.metaKey) &&
    (event.code === "KeyS" || event.key.toLowerCase() === "s" || event.key.toLowerCase() === "ы")
  );
}

/** Physical keys keep editor actions available with a Russian keyboard layout. */
export function editorShortcut(
  event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing" | "repeat">
): "undo" | "redo" | "rotate" | "brick" | "erase" | "select" | "clear" | null {
  if (event.isComposing || event.altKey) return null;
  const key = event.key.toLowerCase();
  const matches = (code: string, latin: string, russian: string) =>
    event.code === code || key === latin || key === russian;
  if (event.ctrlKey || event.metaKey) {
    if (matches("KeyZ", "z", "я")) return event.shiftKey ? "redo" : "undo";
    if (!event.shiftKey && matches("KeyY", "y", "н")) return "redo";
    return null;
  }
  if (event.shiftKey || event.repeat) return null;
  if (matches("KeyR", "r", "к")) return "rotate";
  if (matches("KeyB", "b", "и")) return "brick";
  if (matches("KeyE", "e", "у")) return "erase";
  if (matches("KeyV", "v", "м")) return "select";
  if (key === "escape") return "clear";
  return null;
}
