/** The parts of the YouTube IFrame API we use (https://developers.google.com/youtube/iframe_api_reference). */
export interface YTPlayer {
  getCurrentTime?(): number;
  setPlaybackRate?(rate: number): void;
  destroy(): void;
}

/** YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
export const YT_PLAYING = 1;

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number>;
      events?: {
        onStateChange?: (e: { data: number }) => void;
        onPlaybackRateChange?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApi: Promise<YTNamespace> | undefined;

/** Loads https://www.youtube.com/iframe_api once per page. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  ytApi ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return ytApi;
}
