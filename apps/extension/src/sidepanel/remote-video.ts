import type { MediaLike } from "../avatar/sync";
import type { VideoSnapshot } from "../messages";

/**
 * The YouTube <video> as seen from the side panel. Snapshots arrive on every media event and ~4×/s while
 * playing; between them `currentTime` runs on the local clock, so the avatar moves smoothly.
 * It fires the same events as a real <video> (play, pause, seeked, ratechange), plus `adchange`,
 * so `createVideoSync` drives it exactly like the in-page player.
 */
export class RemoteVideo extends EventTarget {
  paused = true;
  playbackRate = 1;
  adShowing = false;
  private baseTime = 0;
  private baseAt = 0;

  constructor(private readonly now: () => number = () => performance.now()) {
    super();
  }

  get currentTime(): number {
    if (this.paused) return this.baseTime;
    return this.baseTime + ((this.now() - this.baseAt) / 1000) * this.playbackRate;
  }

  apply(snapshot: VideoSnapshot, receivedAt: number = Date.now()): void {
    const was = { paused: this.paused, rate: this.playbackRate, ad: this.adShowing };
    const latencySec = Math.max(0, (receivedAt - snapshot.sentAt) / 1000);

    this.paused = snapshot.paused;
    this.playbackRate = snapshot.playbackRate;
    this.adShowing = snapshot.adShowing;
    this.baseTime = snapshot.currentTime + (snapshot.paused ? 0 : latencySec * snapshot.playbackRate);
    this.baseAt = this.now();

    if (was.rate !== this.playbackRate) this.emit("ratechange");
    if (was.paused !== this.paused) this.emit(this.paused ? "pause" : "play");
    if (was.ad !== this.adShowing) this.emit("adchange");
    if (snapshot.event === "seeked") this.emit("seeked");
  }

  /** Back to "nothing playing", e.g. when the tab navigates away. */
  reset(): void {
    this.apply({ event: "seeked", currentTime: 0, paused: true, playbackRate: 1, adShowing: false, sentAt: Date.now() });
  }

  /** Typed view for createVideoSync. */
  asMedia(): MediaLike {
    return this as unknown as MediaLike;
  }

  private emit(type: string) {
    this.dispatchEvent(new Event(type));
  }
}
