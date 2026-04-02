import fetch from "node-fetch";
import readline from "readline";

const API_BASE = "http://localhost:4000";

// Admin credentials - will be prompted
const ADMIN_PHONE = process.argv[2] || "0759097157";
const ADMIN_PASSWORD = process.argv[3];

async function promptPassword() {
  if (ADMIN_PASSWORD) {
    return ADMIN_PASSWORD;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`Enter admin password for ${ADMIN_PHONE}: `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function resetDatabase() {
  try {
    const password = await promptPassword();

    console.log("🔐 Logging in as admin...");

    // Login to get token
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: ADMIN_PHONE,
        password: password,
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${error.error || "Unknown error"}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log("✅ Admin logged in successfully\n");

    // Call reset endpoint
    console.log("🔄 Resetting database (keeping admin data)...");
    const resetResponse = await fetch(`${API_BASE}/api/admin/reset-database`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        confirm: "DELETE_ALL_DATA",
      }),
    });

    if (!resetResponse.ok) {
      const error = await resetResponse.json();
      throw new Error(`Reset failed: ${error.error || "Unknown error"}`);
    }

    const resetData = await resetResponse.json();
    console.log("\n✅ Database reset successfully!\n");
    console.log("📊 Deleted counts:");
    console.log(`   Members: ${resetData.deletedCounts.members}`);
    console.log(`   Payments: ${resetData.deletedCounts.payments}`);
    console.log(`   Cycles: ${resetData.deletedCounts.cycles}`);
    console.log(`   Loans: ${resetData.deletedCounts.loans}`);
    console.log(`   Disbursements: ${resetData.deletedCounts.disbursements}`);
    console.log(`   Announcements: ${resetData.deletedCounts.announcements}`);
    console.log("\n✓ Admin data preserved");
    console.log("\n🎉 All data has been reset to zero!");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\nMake sure:");
    console.error("1. Backend server is running on port 4000");
    console.error("2. Admin credentials are correct");
    console.error("3. MongoDB is connected");
    process.exit(1);
  }
}

resetDatabase();
