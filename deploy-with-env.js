// ⚠️ DEPRECATED: This script is no longer needed
// GitHub Actions now handles automated deployment with environment variables
// See .github/workflows/deploy.yml for the new deployment pipeline
//
// To deploy: Simply push to master branch and GitHub Actions will automatically build and deploy
// To configure: Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as GitHub Secrets
//
// If you still want to deploy manually, use:
// 1. Create a .env file with your credentials
// 2. Run: npm run build
// 3. Run: npm run deploy

import { execSync } from 'child_process';

// Credentials are now managed via GitHub Secrets - no need to hardcode here
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

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
