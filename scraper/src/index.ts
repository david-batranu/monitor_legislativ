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
        console.log(`[Cache] Loading ${url} from ${cachePath}`);
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
  // We navigate to base URL first to establish session if needed (not cached)
  console.log(`Navigating to base: ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await getRandomDelay(1000, 2000);

  await navigateWithCache(page, url, 'domcontentloaded');
  
  const links = await page.locator('a[href*="/pls/proiecte/upl_pck2015.proiect"]').evaluateAll((elements: HTMLAnchorElement[]) => 
    elements.map(el => el.href)
  );
  
  return [...new Set(links)];
}

async function scrapeDetailPage(page: Page, url: string): Promise<LegislativeJSON | null> {
  try {
    const isFromCache = await navigateWithCache(page, url, 'domcontentloaded');
    if (!isFromCache) {
        await getRandomDelay(1000, 2000);
    }

    // Extract Title
    const title = await page.locator('table tr td font b').first().innerText().catch(() => 'Titlu Necunoscut');

    // Extract Registration Number
    const bodyText = await page.locator('body').innerText();
    const regNumMatch = bodyText.match(/(?:PL-x nr\.|L|PL-x)\s*(\d+\/\d{2}\.\d{2}\.\d{4}|\d+\/\d{4})/i);
    const registrationNumber = regNumMatch ? regNumMatch[0].trim() : 'N/A';

    // Parse "Traseu legislativ"
    const statusHistory: StatusHistoryEntry[] = [];
    
    // Find table containing legislative path
    const rows = page.locator('table tr');
    const rowCount = await rows.count();
    
    for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const text = await row.innerText();
        if (text.toLowerCase().includes('traseu legislativ') || text.toLowerCase().includes('derularea procedurii')) {
            const siblingRows = page.locator('table').filter({ hasText: /Traseu legislativ|Derularea procedurii/i }).locator('tr');
            const siblingCount = await siblingRows.count();
            for (let j = 0; j < siblingCount; j++) {
                const cols = siblingRows.nth(j).locator('td');
                if (await cols.count() >= 2) {
                    const dateText = (await cols.nth(0).innerText()).trim();
                    const eventText = (await cols.nth(1).innerText()).trim();
                    if (dateText.match(/^\d{1,2}\s+[a-z]+\.\s+\d{4}$/i)) {
                        statusHistory.push({
                            statusLabel: eventText,
                            timestamp: parseRomanianDate(dateText),
                            location: 'Camera Deputaților',
                        });
                    }
                }
            }
            break;
        }
    }

    const currentStatus = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1].statusLabel : 'Înregistrat';

    return {
        law: {
            title: title.trim(),
            registrationNumber,
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
    console.log('Starting Playwright scraper (2026 Session with Cache)...');
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
            if (data) results.push(data);
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
