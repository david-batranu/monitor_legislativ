import { chromium, Page, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Using relative import for the shared types
import { LegislativeJSON, StatusHistoryEntry, Chamber } from '../../backend/src/types';

const BASE_URL = 'https://www.cdep.ro';
const LISTING_URL = `${BASE_URL}/ords/pls/proiecte/upl_pck2015.lista?cam=2&anp=2026`;
const CACHE_DIR = path.join(__dirname, '..', 'cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Romanian month abbreviations used by CDEP
const roMonths: Record<string, string> = {
  'ian.': '01',
  'feb.': '02',
  'mar.': '03',
  'apr.': '04',
  'mai': '05',
  'iun.': '06',
  'iul.': '07',
  'aug.': '08',
  'sep.': '09',
  'oct.': '10',
  'nov.': '11',
  'dec.': '12',
};

function parseRomanianDate(dateStr: string): string {
  const parts = dateStr.trim().toLowerCase().split(/\s+/);
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, '0');
    const monthStr = parts[1];
    const year = parts[2];
    
    const month = roMonths[monthStr] || '01';
    
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }
  return new Date().toISOString();
}

async function getRandomDelay(min = 1000, max = 3000) {
  return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));
}

/**
 * Helper to get/set content from local cache
 */
async function navigateWithCache(page: Page, url: string, waitUntil: 'domcontentloaded' | 'networkidle' = 'domcontentloaded'): Promise<boolean> {
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const cachePath = path.join(CACHE_DIR, `${urlHash}.html`);

    if (fs.existsSync(cachePath)) {
        console.log(`[Cache] Loading ${url} from disk`);
        const content = fs.readFileSync(cachePath, 'utf-8');
        await page.setContent(content);
        return true;
    }

    console.log(`[Network] Fetching ${url}...`);
    await page.goto(url, { waitUntil });
    const content = await page.content();
    fs.writeFileSync(cachePath, content, 'utf-8');
    return false;
}

async function scrapeListingPage(page: Page, url: string): Promise<string[]> {
  const urlHash = crypto.createHash('md5').update(url).digest('hex');
  const cachePath = path.join(CACHE_DIR, `${urlHash}.html`);

  if (fs.existsSync(cachePath)) {
    console.log(`[Cache] Loading listing ${url} from disk`);
    const content = fs.readFileSync(cachePath, 'utf-8');
    await page.setContent(content);
  } else {
    console.log(`Navigating to base: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await getRandomDelay(1000, 2000);

    console.log(`[Network] Fetching listing ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const content = await page.content();
    fs.writeFileSync(cachePath, content, 'utf-8');
  }
  
  const links = await page.locator('a[href*="/pls/proiecte/upl_pck2015.proiect"]').evaluateAll((elements: HTMLAnchorElement[], base) => 
    elements.map(el => {
        const href = el.getAttribute('href') || '';
        if (href.startsWith('http')) return href;
        const separator = href.startsWith('/') ? '' : '/';
        return `${base}${separator}${href}`;
    }), BASE_URL
  );
  
  return [...new Set(links)];
}

async function scrapeDetailPage(page: Page, url: string): Promise<LegislativeJSON | null> {
  try {
    const isFromCache = await navigateWithCache(page, url, 'domcontentloaded');
    if (!isFromCache) {
        await getRandomDelay(2000, 4000);
    }

    // Extract Title - more robust selector for CDEP ORDS layout
    const title = await page.locator('.detalii-initiativa h4').first().innerText()
        .catch(() => page.locator('h1, h2').first().innerText())
        .catch(() => 'Titlu Necunoscut');

    // Extract Registration Number
    const registrationNumber = await page.locator('.boxTitle h1').first().innerText()
        .catch(async () => {
            const bodyText = await page.innerText('body');
            const match = bodyText.match(/(?:PL-x|L|PL-x nr\.)\s*(\d+(?:\/\d{2}\.\d{2}\.\d{4}|\/\d{4}))/i);
            return match ? match[0].trim() : 'N/A';
        });

    // Parse "Traseu legislativ" (Derularea procedurii legislative)
    const statusHistory: StatusHistoryEntry[] = [];
    
    // Target the table that follows the "Derularea procedurii legislative" header
    // or look for a table with a row of bgcolor="#e7c24f"
    const tables = page.locator('table');
    const tableCount = await tables.count();
    
    for (let i = 0; i < tableCount; i++) {
        const table = tables.nth(i);
        const hasHeader = await table.locator('tr[bgcolor="#e7c24f"]').count() > 0;
        if (hasHeader) {
            const rows = table.locator('tr[valign="top"]');
            const rowCount = await rows.count();
            for (let j = 0; j < rowCount; j++) {
                const row = rows.nth(j);
                const cols = row.locator('td');
                if (await cols.count() >= 3) {
                    const dateText = (await cols.nth(0).innerText()).trim();
                    const eventText = (await cols.nth(2).innerText()).trim();
                    // Match date format: 02.02.2026 or 12 oct. 2026
                    if (dateText.match(/^\d{2}\.\d{2}\.\d{4}$/) || dateText.match(/^\d{1,2}\s+[a-z]+\.\s+\d{4}$/i)) {
                        statusHistory.push({
                            statusLabel: eventText.split('\n')[0].trim(), // Take only first line of event
                            timestamp: dateText.includes('.') && !dateText.includes(' ') 
                                ? new Date(dateText.split('.').reverse().join('-')).toISOString()
                                : parseRomanianDate(dateText),
                            location: 'Camera Deputaților',
                        });
                    }
                }
            }
            if (statusHistory.length > 0) break;
        }
    }

    const currentStatus = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1].statusLabel : 'Înregistrat';

    return {
        law: {
            title: title.trim(),
            registrationNumber: registrationNumber.trim(),
            currentStatus,
            chamber: 'CDEP' as Chamber,
            originalUrl: url,
        },
        statusHistory,
    };
  } catch (error) {
    console.error(`Failed to parse ${url}:`, error);
    return null;
  }
}

async function main() {
    console.log('Starting Playwright scraper (2026 Session)...');
    const browser: Browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    
    const results: LegislativeJSON[] = [];
    
    try {
        const projectUrls = await scrapeListingPage(page, LISTING_URL);
        console.log(`Found ${projectUrls.length} projects. Processing first 3...`);
        
        for (const url of projectUrls.slice(0, 3)) {
            const data = await scrapeDetailPage(page, url);
            if (data) {
                results.push(data);
                console.log(`Successfully scraped: ${data.law.registrationNumber} - ${data.law.title.substring(0, 50)}...`);
                console.log(`  Events: ${data.statusHistory?.length || 0}`);
            }
        }
        
        const outDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
        
        const outFile = path.join(outDir, `scraped_data_2026_${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf-8');
        
        console.log(`Successfully processed ${results.length} projects to ${outFile}`);
    } catch (error) {
        console.error('Scraper failed:', error);
    } finally {
        await browser.close();
    }
}

main();
