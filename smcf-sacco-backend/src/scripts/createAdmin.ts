import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

dotenv.config();

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const run = async (): Promise<void> => {
  const mongoUri = requiredEnv('MONGODB_URI');
  const email = requiredEnv('ADMIN_EMAIL').toLowerCase().trim();
  const password = requiredEnv('ADMIN_PASSWORD');
  const fullName = process.env.ADMIN_FULL_NAME || 'SACCO Admin';
  const roles = (process.env.ADMIN_ROLES || 'admin').split(',').map((r) => r.trim()).filter(Boolean);

  await mongoose.connect(mongoUri);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const existing = await User.findOne({ email }).select('+password');
  if (existing) {
    existing.password = hashedPassword;
    existing.fullName = existing.fullName || fullName;
    existing.roles = Array.from(new Set([...(existing.roles || []), ...roles]));
    existing.isEmailVerified = true;
    await existing.save();
    console.log('Admin user updated successfully.');
  } else {
    await User.create({
      email,
      password: hashedPassword,
      fullName,
      roles: roles.length ? roles : ['admin'],
      isEmailVerified: true,
    });
    console.log('Admin user created successfully.');
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Failed to create/update admin:', error.message);
  mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
