import { createApiClient } from "@signstream/shared";

/** Set NEXT_PUBLIC_API_URL to the API origin. Without it, the site shows the shared mock data (and says so). */
export const apiUrl = process.env.NEXT_PUBLIC_API_URL;
export const api = createApiClient({ baseUrl: apiUrl ?? "", mock: !apiUrl });

/** Always the shared sample track: the landing page's looping demo. */
export const demoApi = createApiClient({ baseUrl: "", mock: true });
