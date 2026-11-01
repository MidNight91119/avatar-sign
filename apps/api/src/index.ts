/** Production entry point: wires real services and starts the Bun server. */
import { createApp } from "./app";
import { describeEnv, loadEnv } from "./env";
import { createServices } from "./services";

const env = loadEnv();
const app = createApp(createServices(env));

console.log("SignStream API config", describeEnv(env));
console.log(`SignStream API on http://localhost:${env.PORT}`);

export default { port: env.PORT, fetch: app.fetch };
