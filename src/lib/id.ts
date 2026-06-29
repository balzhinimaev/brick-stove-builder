/**
 * Collision-free id generation. Replaces the old `Date.now()`-based ids, which
 * could collide on rapid taps within the same millisecond.
 */
let counter = 0;

export function nextSeq(): number {
  return counter++;
}

export function uniqueId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${nextSeq()}-${performance.now().toString(36)}`;
}
