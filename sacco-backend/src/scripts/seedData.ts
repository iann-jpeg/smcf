import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Member from '../models/Member';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    
    console.log('Connected to MongoDB');
    
    // Clear existing data (optional - comment out in production!)
    // await User.deleteMany({});
    // await Member.deleteMany({});
    
    // Create primary admin user
    const adminPassword = await bcrypt.hash('Abungana@#tag2023', 10);
    const adminUser = await User.create({
      email: 'abunganaian3@gmail.com',
      password: adminPassword,
      fullName: 'System Administrator',
      roles: ['admin']
    });
    
    console.log('Primary admin user created:', adminUser.email);
    
    // Create credit officer
    const creditOfficerPassword = await bcrypt.hash('officer123', 10);
    const creditOfficer = await User.create({
      email: 'officer@smcfsacco.com',
      password: creditOfficerPassword,
      fullName: 'Credit Officer',
      roles: ['credit_officer']
    });
    
    console.log('Credit officer created:', creditOfficer.email);
    
    // Create treasurer
    const treasurerPassword = await bcrypt.hash('treasurer123', 10);
    const treasurer = await User.create({
      email: 'treasurer@smcfsacco.com',
      password: treasurerPassword,
      fullName: 'Treasurer',
      roles: ['treasurer']
    });
    
    console.log('Treasurer created:', treasurer.email);
    
    // Create sample members
    const sampleMembers = [
      {
        memberId: 'MEM2024001',
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+254712345678',
        joinDate: new Date('2024-01-15'),
        status: 'active',
        savings: 50000,
        shares: 10000,
        kycVerified: true
      },
      {
        memberId: 'MEM2024002',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+254723456789',
        joinDate: new Date('2024-02-20'),
        status: 'active',
        savings: 75000,
        shares: 15000,
        kycVerified: true
      },
      {
        memberId: 'MEM2024003',
        name: 'Peter Kamau',
        email: 'peter.kamau@example.com',
        phone: '+254734567890',
        joinDate: new Date('2024-03-10'),
        status: 'active',
        savings: 30000,
        shares: 5000,
        kycVerified: false
      }
    ];
    
    await Member.insertMany(sampleMembers);
    console.log('Sample members created');
    
    console.log('\n=== Seed Data Summary ===');
    console.log('Primary Admin: abunganaian3@gmail.com / Abungana@#tag2023');
    console.log('Credit Officer: officer@smcfsacco.com / officer123');
    console.log('Treasurer: treasurer@smcfsacco.com / treasurer123');
    console.log('========================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
