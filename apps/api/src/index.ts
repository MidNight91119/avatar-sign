import { app } from "./app";

const port = Number(process.env.PORT ?? 8787);

export default { port, fetch: app.fetch };

console.log(`SignStream API on http://localhost:${port}`);
