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
  // randomUUID requires HTTPS, but getRandomValues also works on HTTP deployments.
  // Session-relative timers and counters alone can repeat after a reload or in another tab.
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `${prefix}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  return `${prefix}-${nextSeq()}-${performance.now().toString(36)}`;
}
