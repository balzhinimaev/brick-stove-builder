import type { PlacedBrick } from "../../domain/types";

/** Avoid argument-count limits when imported projects contain many parts. */
export function assemblyTotalRows(bricks: readonly Pick<PlacedBrick, "row">[], rowCount: number): number {
  if (!bricks.length) return 0;
  return bricks.reduce((total, brick) => Math.max(total, brick.row), rowCount);
}

export function assemblyFrame(bricks: PlacedBrick[], row: number) {
  return { visible: bricks.filter((b) => b.row <= row), fresh: bricks.filter((b) => b.row === row) };
}

/** Owns only presentation state. No editor callbacks or persistence access. */
export class AssemblyPlayback {
  row = 0;
  playing = false;
  speed = 1;
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(
    readonly total: number,
    private changed: () => void
  ) {}
  private clear() {
    clearInterval(this.timer);
    this.timer = undefined;
  }
  pause() {
    this.clear();
    this.playing = false;
    this.changed();
  }
  play() {
    if (!this.total || this.playing) return;
    if (this.row >= this.total) this.row = 0;
    this.playing = true;
    this.timer = setInterval(() => {
      this.row = Math.min(this.total, this.row + 1);
      if (this.row === this.total) this.pause();
      else this.changed();
    }, 1000 / this.speed);
    this.changed();
  }
  seek(row: number) {
    this.clear();
    this.playing = false;
    this.row = Math.max(0, Math.min(this.total, Math.floor(row) || 0));
    this.changed();
  }
  setSpeed(speed: number) {
    if (![0.5, 1, 2].includes(speed)) return;
    const resume = this.playing;
    this.clear();
    this.playing = false;
    this.speed = speed;
    if (resume) this.play();
    else this.changed();
  }
  dispose() {
    this.clear();
    this.playing = false;
  }
}

export function bindPlaybackVisibility(
  player: AssemblyPlayback,
  target: Pick<Document, "hidden" | "addEventListener" | "removeEventListener">
) {
  const hide = () => {
    if (target.hidden) player.pause();
  };
  target.addEventListener("visibilitychange", hide);
  hide();
  return () => {
    target.removeEventListener("visibilitychange", hide);
    player.dispose();
  };
}
