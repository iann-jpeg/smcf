import mongoose from 'mongoose';
import Cycle from '../models/Cycle.js';

const MONGO_URI = 'mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf?retryWrites=true&w=majority&appName=Cluster0';

async function updateCycleStartDate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the active cycle
    const activeCycle = await Cycle.findOne({ status: 'active' });

    if (!activeCycle) {
      console.log('❌ No active cycle found');
      process.exit(0);
    }

    console.log('\n📊 Current Active Cycle:');
    console.log(`   Cycle #${activeCycle.cycle_number}`);
    console.log(`   Old Start Date: ${activeCycle.start_date.toLocaleString()}`);
    console.log(`   Old End Date: ${activeCycle.end_date.toLocaleString()}`);

    // Official cycle start date: January 5, 2026
    const firstCycleStart = new Date('2026-01-05T00:00:00.000Z');
    
    // Calculate start date for this cycle number
    const newStartDate = new Date(
      firstCycleStart.getTime() + 
      ((activeCycle.cycle_number - 1) * 5 * 24 * 60 * 60 * 1000)
    );
    const newEndDate = new Date(newStartDate.getTime() + 5 * 24 * 60 * 60 * 1000);

    // Update the cycle
    activeCycle.start_date = newStartDate;
    activeCycle.end_date = newEndDate;
    await activeCycle.save();

    console.log('\n✅ Updated Cycle Dates:');
    console.log(`   Cycle #${activeCycle.cycle_number}`);
    console.log(`   New Start Date: ${activeCycle.start_date.toLocaleString()}`);
    console.log(`   New End Date: ${activeCycle.end_date.toLocaleString()}`);
    
    // Calculate days remaining
    const now = new Date();
    const daysLeft = Math.max(
      0,
      Math.ceil((newEndDate - now) / (1000 * 60 * 60 * 24))
    );
    console.log(`   Days Remaining: ${daysLeft} days`);

    console.log('\n🎉 Cycle start date updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateCycleStartDate();
