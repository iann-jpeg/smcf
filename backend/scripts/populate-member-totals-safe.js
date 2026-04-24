/**
 * Safely populate member totals from payment records
 * This script handles timeout issues by processing in smaller batches
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, "../.env") });

// Aggressive timeout settings for poor connectivity
const mongooseOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 120000,
  connectTimeoutMS: 30000,
  maxPoolSize: 5,
  minPoolSize: 1,
  retryWrites: true,
  retryReads: true,
};

async function connectWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
      console.log("✅ Connected to MongoDB");
      return true;
    } catch (error) {
      console.error(`❌ Connection attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        const delay = (i + 1) * 3000;
        console.log(`🔄 Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error("Failed to connect after multiple retries");
}

async function populateMemberTotals() {
  try {
    console.log("\n🚀 Starting member totals population...\n");

    await connectWithRetry();

    // Import models after connection
    const { default: Member } = await import("../models/Member.js");
    const { default: Payment } = await import("../models/Payment.js");

    // Get all members in small batches
    const BATCH_SIZE = 10;
    const totalMembers = await Member.countDocuments().maxTimeMS(30000);
    console.log(`📊 Total members to process: ${totalMembers}`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (let skip = 0; skip < totalMembers; skip += BATCH_SIZE) {
      try {
        const members = await Member.find()
          .skip(skip)
          .limit(BATCH_SIZE)
          .select("_id name")
          .lean()
          .maxTimeMS(30000);

        console.log(`\n📦 Processing batch ${Math.floor(skip/BATCH_SIZE) + 1} (${members.length} members)...`);

        for (const member of members) {
          try {
            console.log(`  Processing: ${member.name}...`);
            
            // Get completed payments for this member with timeout
            const payments = await Payment.find({
              member_id: member._id,
              status: "completed"
            })
            .select("amount type")
            .lean()
            .maxTimeMS(30000);

            const total_contributed = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const payment_count = payments.length;
            
            // Calculate breakdown (assuming KES 224 per payment: 200 cycle + 20 credit + 4 fees)
            const total_cycle_contribution = payment_count * 200;
            const total_member_credit = payment_count * 20;
            const total_transaction_fees = payment_count * 4;

            // Update member record
            await Member.findByIdAndUpdate(
              member._id,
              {
                total_contributed,
                total_cycle_contribution,
                total_member_credit,
                total_transaction_fees
              },
              { maxTimeMS: 30000 }
            );

            console.log(`    ✅ ${member.name}: KES ${total_contributed} (${payment_count} payments)`);
            updated++;
          } catch (memberError) {
            console.error(`    ❌ Error processing ${member.name}:`, memberError.message);
            errors++;
            
            // If timeout, wait before continuing
            if (memberError.name === 'MongoNetworkTimeoutError') {
              console.log("    ⏳ Waiting 5 seconds before continuing...");
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
          
          processed++;
        }

        // Pause between batches to avoid overwhelming the connection
        if (skip + BATCH_SIZE < totalMembers) {
          console.log("\n⏳ Pausing 2 seconds before next batch...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (batchError) {
        console.error(`\n❌ Batch error:`, batchError.message);
        console.log("⏳ Waiting 5 seconds before continuing...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        errors++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Successfully updated: ${updated} members`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total processed: ${processed}/${totalMembers}`);
    console.log("=".repeat(60) + "\n");

    if (errors > 0) {
      console.log("⚠️  Some members had errors. You may want to re-run this script.");
    } else {
      console.log("🎉 All member totals populated successfully!");
    }

  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  }
}

// Run the population
populateMemberTotals();
