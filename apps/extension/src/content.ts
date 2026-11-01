// Runs on youtube.com. Reports the main video's clock to the side panel and applies speed changes from it.
// The panel only reads these numbers; YouTube's page is never changed except video.playbackRate.

const mainVideo = () => document.querySelector<HTMLVideoElement>("#movie_player video");

function report(e: Event) {
  const v = e.target;
  // Media events don't bubble, so this listens in the capture phase. Skip hover previews and ads.
  if (!(v instanceof HTMLVideoElement) || v !== mainVideo() || v.closest(".ad-showing")) return;
  try {
    chrome.runtime
      .sendMessage({ type: "signside:time", t: v.currentTime, rate: v.playbackRate, paused: v.paused })
      .catch(() => {}); // side panel closed
  } catch {
    // extension was reloaded; this old content script is orphaned
  }
}
for (const type of ["timeupdate", "play", "pause", "seeked", "ratechange"]) {
  document.addEventListener(type, report, true);
}

chrome.runtime.onMessage.addListener((msg: { type?: string; rate?: unknown }) => {
  const v = mainVideo();
  if (msg?.type === "signside:rate" && typeof msg.rate === "number" && msg.rate > 0 && msg.rate <= 2 && v) {
    v.playbackRate = msg.rate;
  }
});
