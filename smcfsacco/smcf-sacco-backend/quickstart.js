#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 SMCF SACCO Backend Quick Start\n');

// Check if .env exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Creating from .env.example...');
  fs.copyFileSync(
    path.join(__dirname, '.env.example'),
    envPath
  );
  console.log('✅ .env file created. Please update it with your MongoDB URI and JWT secret.\n');
  console.log('To generate JWT_SECRET run:');
  console.log('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  console.log('\nUpdate the .env file and run this script again.\n');
  process.exit(0);
}

// Check if node_modules exists
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed\n');
}

// Check if dist folder exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  console.log('🔨 Building TypeScript...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed\n');
}

console.log('🎉 Setup complete! Starting development server...\n');
console.log('Backend will be available at: http://localhost:5000');
console.log('API endpoints at: http://localhost:5000/api');
console.log('Health check: http://localhost:5000/health\n');

// Start dev server
execSync('npm run dev', { stdio: 'inherit' });
