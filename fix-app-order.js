// Fix production database sortOrder values for app launcher tiles
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';

// Define the applications table schema for the fix
const applications = {
  id: 'id',
  name: 'name',
  sortOrder: 'sort_order'
};

async function fixProductionAppOrder() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 1
  });

  const db = drizzle(sql);

  try {
    console.log('🔧 Fixing production database app sortOrder values...');

    // First, check current values
    const currentApps = await sql`SELECT name, sort_order FROM applications ORDER BY sort_order`;
    console.log('Current sortOrder values:', currentApps);

    // Update Settings from sortOrder 2 to 4
    await sql`UPDATE applications SET sort_order = 4 WHERE name = 'settings'`;
    console.log('✅ Updated Settings to sortOrder 4');

    // Update portfolioAI from sortOrder 3 to 2
    await sql`UPDATE applications SET sort_order = 2 WHERE name = 'portfolio-ai'`;
    console.log('✅ Updated portfolio-ai to sortOrder 2');

    // Update itineraryAI from sortOrder 4 to 3
    await sql`UPDATE applications SET sort_order = 3 WHERE name = 'itinerary-ai'`;
    console.log('✅ Updated itinerary-ai to sortOrder 3');

    // Verify the fix
    const updatedApps = await sql`SELECT name, sort_order FROM applications ORDER BY sort_order`;
    console.log('Updated sortOrder values:', updatedApps);

    console.log('🎉 Production database sortOrder fix completed successfully!');
  } catch (error) {
    console.error('❌ Error fixing sortOrder values:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Check if this file is being run directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run the fix if this file is executed directly
if (process.argv[1] === __filename) {
  fixProductionAppOrder()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { fixProductionAppOrder };