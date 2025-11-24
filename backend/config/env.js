import dotenv from "dotenv";
import { dirname } from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend root directory (one level up from config/)
const result = dotenv.config();

if (result.error) {
  console.error("❌ Error loading .env file:", result.error);
} else {
  console.log("✅ Environment variables loaded successfully");
}

export default process.env;
