/**
 * Script to add database indexes for improved query performance
 * 
 * Run this script once: node backend/scripts/add-performance-indexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import Member from '../models/Member.js';
import Loan from '../models/Loan.js';
import Payment from '../models/Payment.js';
import Saving from '../models/Saving.js';
import UserSession from '../models/UserSession.js';
import ActivityLog from '../models/ActivityLog.js';
import SearchLog from '../models/SearchLog.js';

async function addIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB\n');

    console.log('Adding performance indexes...\n');

    // Member indexes
    console.log('Adding Member indexes...');
    await Member.collection.createIndex({ member_id: 1 });
    await Member.collection.createIndex({ phone: 1 });
    await Member.collection.createIndex({ status: 1 });
    await Member.collection.createIndex({ position: 1 });
    await Member.collection.createIndex({ member_type: 1 });
    await Member.collection.createIndex({ name: 'text' }); // Text search
    console.log('✓ Member indexes added');

    // Loan indexes
    console.log('Adding Loan indexes...');
    await mongoose.connection.db.collection('loans').createIndex({ member_id: 1, status: 1 });
    await mongoose.connection.db.collection('loans').createIndex({ status: 1, disbursement_date: -1 });
    await mongoose.connection.db.collection('loans').createIndex({ loan_id: 1 });
    await mongoose.connection.db.collection('loans').createIndex({ disbursement_date: -1 });
    await mongoose.connection.db.collection('loans').createIndex({ due_date: 1 });
    console.log('✓ Loan indexes added');

    // Payment indexes
    console.log('Adding Payment indexes...');
    await mongoose.connection.db.collection('payments').createIndex({ member_id: 1, transaction_date: -1 });
    await mongoose.connection.db.collection('payments').createIndex({ loan_id: 1 });
    await mongoose.connection.db.collection('payments').createIndex({ transaction_date: -1 });
    await mongoose.connection.db.collection('payments').createIndex({ payment_method: 1 });
    console.log('✓ Payment indexes added');

    // Saving indexes
    console.log('Adding Saving indexes...');
    await mongoose.connection.db.collection('savings').createIndex({ member_id: 1, transaction_date: -1 });
    await mongoose.connection.db.collection('savings').createIndex({ cycle_number: 1 });
    await mongoose.connection.db.collection('savings').createIndex({ transaction_date: -1 });
    console.log('✓ Saving indexes added');

    // UserSession indexes
    console.log('Adding UserSession indexes...');
    await UserSession.collection.createIndex({ userId: 1, loginTime: -1 });
    await UserSession.collection.createIndex({ isActive: 1 });
    await UserSession.collection.createIndex({ loginTime: -1 });
    await UserSession.collection.createIndex({ role: 1 });
    await UserSession.collection.createIndex({ deviceType: 1 });
    console.log('✓ UserSession indexes added');

    // ActivityLog indexes
    console.log('Adding ActivityLog indexes...');
    await ActivityLog.collection.createIndex({ userId: 1, createdAt: -1 });
    await ActivityLog.collection.createIndex({ activityType: 1, createdAt: -1 });
    await ActivityLog.collection.createIndex({ createdAt: -1 });
    await ActivityLog.collection.createIndex({ status: 1 });
    console.log('✓ ActivityLog indexes added');

    // SearchLog indexes (already has some, adding more)
    console.log('Adding SearchLog indexes...');
    await SearchLog.collection.createIndex({ userId: 1, createdAt: -1 });
    await SearchLog.collection.createIndex({ searchCategory: 1, createdAt: -1 });
    await SearchLog.collection.createIndex({ suspicious: 1 });
    console.log('✓ SearchLog indexes added');

    console.log('\n✅ All performance indexes added successfully!');
    console.log('\nIndexes will significantly improve query performance for:');
    console.log('- Member lookups by ID, phone, and status');
    console.log('- Loan queries by member and status');
    console.log('- Payment and saving history retrieval');
    console.log('- Session and activity tracking');
    console.log('- Analytics dashboard queries');

  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

addIndexes();
