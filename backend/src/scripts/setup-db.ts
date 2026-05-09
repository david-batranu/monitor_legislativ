import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load from .env or .dev.vars
dotenv.config({ path: path.join(process.cwd(), '.dev.vars') });
dotenv.config(); // fallback to .env

async function setup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  // derive the base connection URL (to 'postgres' db) to create our target DB if it doesn't exist
  // Assuming format: postgres://user:pass@host:port/dbname
  const urlObj = new URL(dbUrl);
  const targetDb = urlObj.pathname.substring(1);
  urlObj.pathname = '/postgres';
  const sqlDefault = postgres(urlObj.toString());
  
  try {
    console.log(`Checking if database ${targetDb} exists...`);
    const databases = await sqlDefault`SELECT datname FROM pg_database WHERE datname = ${targetDb}`;
    
    if (databases.length === 0) {
      console.log(`Creating database ${targetDb}...`);
      await sqlDefault.unsafe(`CREATE DATABASE ${targetDb}`);
      console.log('Database created successfully.');
    } else {
      console.log(`Database ${targetDb} already exists.`);
    }
  } catch (err: any) {
    console.error('Error during setup:', err.message);
  } finally {
    await sqlDefault.end();
  }
}

setup();
