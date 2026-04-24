/**
 * Script to seed search logs for testing analytics
 * 
 * Usage: node backend/scripts/seed-search-logs.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import SearchLog from '../models/SearchLog.js';
import Member from '../models/Member.js';
import Admin from '../models/Admin.js';

const SEARCH_TERMS = [
  { term: 'john kamau', category: 'members' },
  { term: 'SMCF001', category: 'members' },
  { term: 'loan status', category: 'loans' },
  { term: 'payment history', category: 'transactions' },
  { term: '0712345678', category: 'members' },
  { term: 'savings balance', category: 'savings' },
  { term: 'active loans', category: 'loans' },
  { term: 'mary wanjiru', category: 'members' },
  { term: 'SMCF002', category: 'members' },
  { term: 'loan repayment', category: 'transactions' },
  { term: 'member list', category: 'members' },
  { term: 'cycle payments', category: 'transactions' },
  { term: 'pending approvals', category: 'loans' },
  { term: 'total savings', category: 'reports' },
  { term: 'jane muthoni', category: 'members' },
  { term: 'loan application', category: 'loans' },
  { term: 'deposit', category: 'savings' },
  { term: 'withdrawal', category: 'savings' },
  { term: 'interest rate', category: 'general' },
  { term: 'payment due', category: 'transactions' }
];

const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'];

async function seedSearchLogs() {
  try {
    console.log('Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Get some members and admins to use as search users
    const members = await Member.find({ status: 'active' }).limit(10).lean();
    const admins = await Admin.find().limit(5).lean();

    if (members.length === 0 && admins.length === 0) {
      console.log('No members or admins found. Please ensure the database has users.');
      process.exit(1);
    }

    const users = [
      ...members.map(m => ({ id: m._id, model: 'Member', role: 'member' })),
      ...admins.map(a => ({ id: a._id, model: 'Admin', role: a.role || 'admin' }))
    ];

    console.log(`Found ${users.length} users (${members.length} members, ${admins.length} admins)`);

    // Clear existing search logs (optional - comment out if you want to keep existing data)
    // await SearchLog.deleteMany({});
    // console.log('Cleared existing search logs');

    const searchLogs = [];
    const now = new Date();

    // Generate search logs for the last 30 days
    for (let day = 0; day < 30; day++) {
      // Number of searches per day (random between 5-20)
      const searchesPerDay = Math.floor(Math.random() * 16) + 5;

      for (let i = 0; i < searchesPerDay; i++) {
        const searchData = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
        const user = users[Math.floor(Math.random() * users.length)];
        const deviceType = DEVICE_TYPES[Math.floor(Math.random() * DEVICE_TYPES.length)];
        
        // Create timestamp for this search (random time during the day)
        const searchDate = new Date(now);
        searchDate.setDate(searchDate.getDate() - day);
        searchDate.setHours(Math.floor(Math.random() * 24));
        searchDate.setMinutes(Math.floor(Math.random() * 60));
        searchDate.setSeconds(Math.floor(Math.random() * 60));

        const resultsCount = Math.floor(Math.random() * 50) + 1;
        
        // 5% chance of suspicious search
        const suspicious = Math.random() < 0.05;

        searchLogs.push({
          searchTerm: searchData.term,
          searchCategory: searchData.category,
          userId: user.id,
          userModel: user.model,
          userRole: user.role,
          resultsCount,
          deviceType,
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
          suspicious,
          archived: false,
          createdAt: searchDate,
          updatedAt: searchDate
        });
      }
    }

    console.log(`Inserting ${searchLogs.length} search logs...`);
    await SearchLog.insertMany(searchLogs);
    
    console.log('✅ Search logs seeded successfully!');
    
    // Show statistics
    const totalSearches = await SearchLog.countDocuments();
    const topSearches = await SearchLog.aggregate([
      { $group: { _id: '$searchTerm', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const searchesByCategory = await SearchLog.aggregate([
      { $group: { _id: '$searchCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const suspiciousCount = await SearchLog.countDocuments({ suspicious: true });

    console.log('\n📊 Statistics:');
    console.log(`Total searches: ${totalSearches}`);
    console.log(`Suspicious searches: ${suspiciousCount}`);
    console.log('\nTop 5 searches:');
    topSearches.forEach((s, i) => console.log(`  ${i + 1}. "${s._id}" - ${s.count} times`));
    console.log('\nSearches by category:');
    searchesByCategory.forEach(c => console.log(`  ${c._id}: ${c.count}`));

  } catch (error) {
    console.error('Error seeding search logs:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

seedSearchLogs();
