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
