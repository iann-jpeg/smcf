import mongoose from 'mongoose';
import Cycle from '../models/Cycle.js';
import Member from '../models/Member.js';

const MONGODB_URI = 'mongodb+srv://valinyala24472:Abungana24472@cluster0.rtgyu8k.mongodb.net/smcf?retryWrites=true&w=majority&appName=Cluster0';

async function updateCycleMembersCount() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Count total members
    const totalMembers = await Member.countDocuments();
    console.log(`👥 Total members in database: ${totalMembers}`);

    // Get current active cycle
    const currentCycle = await Cycle.findOne({ status: 'active' })
      .sort({ cycle_number: -1 })
      .populate('next_recipient', 'name member_id');

    if (!currentCycle) {
      console.log('❌ No active cycle found');
      process.exit(0);
    }

    console.log(`\n📊 Current Cycle #${currentCycle.cycle_number}:`);
    console.log(`   Old total_members: ${currentCycle.total_members}`);

    // Update the cycle
    currentCycle.total_members = totalMembers;
    await currentCycle.save();

    console.log(`   ✅ New total_members: ${currentCycle.total_members}`);
    console.log(`\n🎉 Cycle updated successfully!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateCycleMembersCount();
