import dotenv from "dotenv";
import { dirname } from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend root directory (one level up from config/)
// In production (Render), .env file won't exist - env vars come from dashboard
const result = dotenv.config();

if (result.error) {
  // Only warn in development, in production env vars come from platform
  if (process.env.NODE_ENV !== 'production') {
    console.error("❌ Error loading .env file:", result.error);
  } else {
    console.log("ℹ️  No .env file (expected in production - using environment variables)");
  }
} else {
  console.log("✅ Environment variables loaded from .env file");
}

export default process.env;
