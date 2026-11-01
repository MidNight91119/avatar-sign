// The team's shared mock track (PLAN §4.1: everyone builds against mocks/sign-track.sample.json).
import { SignTrackSchema, type SignTrack } from "@signstream/shared";
import sample from "../../../mocks/sign-track.sample.json";

/** 0–3.2s "Hello everyone, my name is Bob." HELLO 0, ALL 0.6, MY 1.1, NAME 1.5, FS:BOB 2–3.05; TODAY at 3.2; … 60s. */
export function sampleTrack(videoId = "dQw4w9WgXcQ"): SignTrack {
  return { ...SignTrackSchema.parse(sample), videoId };
}
