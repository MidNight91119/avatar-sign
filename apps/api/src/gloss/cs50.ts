import { getTranscript, youtubeSource, type VideoSource } from "../transcript";

export const CS50_VIDEOS = [
  {
    videoId: "Fc9htmvVZ9U",
    title: "Data Types",
    courseUrl: "https://cs50.harvard.edu/x/2026/shorts/data_types/",
  },
  {
    videoId: "f1xZf4iJDWE",
    title: "Operators",
    courseUrl: "https://cs50.harvard.edu/x/2026/shorts/operators/",
  },
  {
    videoId: "WgX8e_O7eG8",
    title: "Loops",
    courseUrl: "https://cs50.harvard.edu/x/2026/shorts/loops/",
  },
  {
    videoId: "TwsgCHYmbbA",
    title: "Linear Search",
    courseUrl: "https://cs50.harvard.edu/x/2026/shorts/linear_search/",
  },
  {
    videoId: "T98PIp4omUA",
    title: "Binary Search",
    courseUrl: "https://cs50.harvard.edu/x/2026/shorts/binary_search/",
  },
] as const;

export async function fetchCs50Corpus(source: VideoSource = youtubeSource()) {
  const videos = [];
  for (const video of CS50_VIDEOS) {
    const transcript = await getTranscript(video.videoId, source);
    if (transcript.durationSec > 900)
      throw new Error(`${video.title} exceeds the 15-minute demo limit`);
    videos.push({
      ...video,
      url: `https://youtu.be/${video.videoId}`,
      durationSeconds: transcript.durationSec,
      captionTrack: transcript.track,
      captions: transcript.captions,
    });
  }
  return {
    source: "youtube-captions" as const,
    attribution: {
      creator: "CS50, Harvard University",
      license: "CC BY-NC-SA 4.0",
      licenseUrl: "https://cs50.harvard.edu/x/2026/license/",
      modifications:
        "Timed captions cleaned and normalized by the transcript module",
    },
    videos,
  };
}

if (import.meta.main)
  globalThis.console.log(JSON.stringify(await fetchCs50Corpus(), null, 2));
