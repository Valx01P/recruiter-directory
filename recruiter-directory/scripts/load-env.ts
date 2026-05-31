// Loads .env.local for standalone (tsx) scripts. Next loads it automatically
// for the app, but node scripts don't, so every script imports this first.
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../.env.local") });
