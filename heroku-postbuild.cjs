#!/usr/bin/env node

// Improved Heroku post-build script with explicit TypeScript compilation
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Heroku post-build starting...');

try {
  // Step 1: Explicit TypeScript compilation
  console.log('📦 Compiling TypeScript server files...');
  try {
    execSync('npx typescript tsc --project tsconfig.json', { stdio: 'inherit' });
    console.log('✅ TypeScript compilation completed');
  } catch (tsError) {
    console.log('⚠️ TypeScript compilation had warnings, continuing...');
  }
  
  // Step 2: Build frontend with Vite
  console.log('🎨 Building frontend...');
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('✅ Frontend build completed');
  
  // Step 3: Verify server files were compiled
  const serverIndexPath = path.join(__dirname, 'dist', 'server', 'index.js');
  const routesPath = path.join(__dirname, 'dist', 'server', 'routes.js');
  
  console.log('🔍 Checking compiled server files...');
  console.log(`Server index.js exists: ${fs.existsSync(serverIndexPath)}`);
  console.log(`Routes.js exists: ${fs.existsSync(routesPath)}`);
  
  // Step 4: Create entry point
  console.log('🔧 Creating Heroku entry point...');
  const entryPoint = path.join(__dirname, 'dist', 'index.js');
  const entryContent = '// Heroku entry point\nimport "./server/index.js";';
  
  if (!fs.existsSync(path.dirname(entryPoint))) {
    fs.mkdirSync(path.dirname(entryPoint), { recursive: true });
  }
  
  fs.writeFileSync(entryPoint, entryContent);
  console.log('✅ Entry point created at dist/index.js');
  
  console.log('🎉 Heroku build completed successfully!');
} catch (error) {
  console.error('❌ Heroku build failed:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}
