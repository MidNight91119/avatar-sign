// Error codes come from SignTrack.error (Raashed's API) or from the extension itself.
const MESSAGES: Record<string, string> = {
  NO_CAPTIONS: "No captions available for this video",
  VIDEO_UNAVAILABLE: "This video isn't available",
  LIVE_NOT_SUPPORTED: "Live streams aren't supported yet",
  RATE_LIMITED: "Too many new videos right now. Try again in a few minutes",
  NETWORK: "Can't reach the SignStream server",
  TIMEOUT: "Preparing signs is taking too long. Try again later",
  INVALID_RESPONSE: "The SignStream server sent an unexpected reply",
  EXTENSION_RELOADED: "SignStream was updated. Reload the page to continue",
};

export function describeError(code: string | undefined): string {
  return (code && MESSAGES[code]) || "Couldn't prepare signs for this video";
}
