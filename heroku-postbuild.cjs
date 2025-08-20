#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Heroku build starting...');

try {
  // Step 1: Build frontend (this always works)
  console.log('🎨 Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });
  
  // Step 2: Force create basic server JS files if they don't exist
  console.log('🔧 Ensuring server files exist...');
  
  const serverDir = path.join(__dirname, 'dist', 'server');
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
  }
  
  // Create minimal server/index.js that imports the TypeScript directly
  const serverIndex = path.join(serverDir, 'index.js');
  fs.writeFileSync(serverIndex, `
// Minimal server that imports TypeScript directly using tsx
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function startServer() {
  try {
    // Try to use tsx to run TypeScript directly
    const { spawn } = require('child_process');
    const serverProcess = spawn('npx', ['tsx', '../server/index.ts'], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    serverProcess.on('error', (error) => {
      console.error('Server startup failed:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
`);
  
  // Step 3: Create entry point
  console.log('📦 Creating entry point...');
  const entryPoint = path.join(__dirname, 'dist', 'index.js');
  fs.writeFileSync(entryPoint, 'import "./server/index.js";');
  
  console.log('✅ Build complete!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
