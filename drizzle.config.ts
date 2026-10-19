import { defineConfig } from "drizzle-kit";

// Migrations use the session pooler (DIRECT_URL); the app uses DATABASE_URL at runtime.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
