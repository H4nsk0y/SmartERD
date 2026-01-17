import dotenv from "dotenv";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env.test" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Check .env.test / DOTENV_CONFIG_PATH");
}
