#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Heroku build with bulk delete interactions fix...');

try {
  // Step 1: Build frontend
  console.log('🎨 Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });
  
  // Step 2: Create server files
  console.log('🔧 Creating server files...');
  
  const serverDir = path.join(__dirname, 'dist', 'server');
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
  }
  
  // Create server/index.js with ESM-compatible code
  const serverIndex = path.join(serverDir, 'index.js');
  fs.writeFileSync(serverIndex, `
// Server entry point using tsx to run TypeScript directly
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

console.log('🚀 Starting TypeScript server with tsx...');

const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: { ...process.env, NODE_ENV: 'production' }
});

serverProcess.on('error', (error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(\`❌ Server exited with code \${code}\`);
    process.exit(code);
  }
});
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
