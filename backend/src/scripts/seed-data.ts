import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import { laws, statusHistory } from '../db/schema';
import { eq } from 'drizzle-orm';
import { LegislativeJSON } from '../types';
import * as dotenv from 'dotenv';

// Load from .env or .dev.vars
dotenv.config({ path: path.join(process.cwd(), '.dev.vars') });
dotenv.config();

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = postgres(dbUrl);
  const db = drizzle(client);

  try {
    // Find the latest scraped file
    const dataDir = path.join(process.cwd(), '..', 'scraper', 'data');
    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('scraped_data_2026_') && f.endsWith('.json'));
    
    if (files.length === 0) {
      console.log('No scraped data files found.');
      return;
    }

    const latestFile = files.sort().reverse()[0];
    const filePath = path.join(dataDir, latestFile);
    console.log(`Reading data from ${filePath}...`);
    
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data: LegislativeJSON[] = JSON.parse(rawData);

    console.log(`Found ${data.length} laws to import.`);

    for (const entry of data) {
      const { law: lawData, statusHistory: historyData } = entry;

      console.log(`Importing: ${lawData.registrationNumber}...`);

      // Upsert Law
      const [upsertedLaw] = await db.insert(laws).values({
        title: lawData.title,
        registrationNumber: lawData.registrationNumber,
        currentStatus: lawData.currentStatus,
        chamber: lawData.chamber,
        originalUrl: lawData.originalUrl,
      })
      .onConflictDoUpdate({
        target: laws.registrationNumber,
        set: {
          title: lawData.title,
          currentStatus: lawData.currentStatus,
          chamber: lawData.chamber,
          originalUrl: lawData.originalUrl,
        },
      })
      .returning();

      // Sync Status History
      if (historyData && historyData.length > 0) {
        // Delete existing history for this law to avoid duplicates/stale data
        await db.delete(statusHistory).where(eq(statusHistory.lawId, upsertedLaw.id));
        
        await db.insert(statusHistory).values(
          historyData.map(h => ({
            lawId: upsertedLaw.id,
            statusLabel: h.statusLabel,
            location: h.location || null,
            timestamp: new Date(h.timestamp),
          }))
        );
        console.log(`  - Synced ${historyData.length} events.`);
      }
    }

    console.log('Database population complete!');
  } catch (error: any) {
    console.error('Error during seeding:', error.message);
  } finally {
    await client.end();
  }
}

seed();
