import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Member from '../models/Member';

dotenv.config();

const jsonPath = process.env.MEMBER_JSON_PATH
  ? path.resolve(process.env.MEMBER_JSON_PATH)
  : path.resolve(__dirname, '../../../src/assets/member-statements (1).json');

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const run = async (): Promise<void> => {
  const mongoUri = requiredEnv('MONGODB_URI');

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Member JSON not found: ${jsonPath}`);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const members: Array<{
    memberId: string;
    name: string;
    savings?: number;
    shares?: number;
    loanBalance?: number;
    status?: 'active' | 'inactive' | 'suspended';
  }> = JSON.parse(raw);

  await mongoose.connect(mongoUri);

  let created = 0;
  let updated = 0;

  for (const member of members) {
    const update = {
      name: member.name,
      savings: Number(member.savings || 0),
      shares: Number(member.shares || 0),
      loanBalance: Number(member.loanBalance || 0),
      status: member.status || 'active',
    };

    const result = await Member.updateOne(
      { memberId: member.memberId },
      { $set: update, $setOnInsert: { memberId: member.memberId } },
      { upsert: true }
    );

    if (result.upsertedCount && result.upsertedCount > 0) {
      created += 1;
    } else if (result.modifiedCount && result.modifiedCount > 0) {
      updated += 1;
    }
  }

  console.log(`Import complete. Created: ${created}, Updated: ${updated}, Total: ${members.length}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Import failed:', error.message);
  mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
