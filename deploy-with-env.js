// Script to deploy with environment variables
// Usage: node deploy-with-env.js

import { execSync } from 'child_process';

// Your Supabase credentials (replace with your actual values)
const SUPABASE_URL = 'https://nusnquvsugwnahlurgyo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51c25xdXZzdWd3bmFobHVyZ3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjA5MzAsImV4cCI6MjA3NTUzNjkzMH0.NT0-RfZx1yyFbEJTCnwPjeCfIOn6M-Yf0d4ANT2oZkQ';

console.log('🚀 Building with environment variables...');

try {
  // Build with environment variables
  execSync('npm run build', {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    },
    stdio: 'inherit'
  });

  console.log('✅ Build successful! Deploying to GitHub Pages...');

  // Deploy to GitHub Pages
  execSync('npm run deploy', {
    stdio: 'inherit'
  });

  console.log('🎉 Deployment successful!');
  console.log('Your app is now live at: https://wltoupin-boop.github.io/wltoupin-boop.github.io/');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
