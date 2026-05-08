import axios from 'axios';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';
import * as fs from 'fs';
import * as path from 'path';

// Using relative import for the shared types
import { LegislativeJSON, StatusHistoryEntry, Chamber } from '../../backend/src/types';

const BASE_URL = 'https://www.cdep.ro';
const LISTING_URL = `${BASE_URL}/pls/proiecte/upl_pck.lista`; // This is an example, it changes based on year/session

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

// Parses a date like "12 oct. 2024" to ISO string "2024-10-12T00:00:00.000Z"
function parseRomanianDate(dateStr: string): string {
  const parts = dateStr.trim().toLowerCase().split(' ');
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, '0');
    const monthStr = parts[1];
    const year = parts[2];
    
    const month = roMonths[monthStr] || '01';
    
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }
  return new Date().toISOString(); // Fallback
}

async function fetchPage(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MonitorLegislativ/1.0)',
      },
    });
    // Romanian govt websites usually use iso-8859-2
    return iconv.decode(response.data, 'iso-8859-2');
  } catch (error: any) {
    console.error(`Error fetching page ${url}:`, error.message);
    throw error;
  }
}

async function scrapeListingPage(url: string): Promise<string[]> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  
  const projectLinks: string[] = [];
  
  // Find all links to detail pages
  // E.g. <a href="/pls/proiecte/upl_pck.proiect?idp=12345">
  $('a[href^="/pls/proiecte/upl_pck.proiect"]').each((i, el) => {
    const href = $(el).attr('href');
    if (href) {
      projectLinks.push(`${BASE_URL}${href}`);
    }
  });
  
  // Remove duplicates
  return [...new Set(projectLinks)];
}

async function scrapeDetailPage(url: string): Promise<LegislativeJSON | null> {
  try {
    console.log(`Scraping detail page: ${url}`);
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    
    // Extract Title
    // On CDEP, titles are usually in a table row or a specific font/bold element.
    // Example target: <td class="headline">Proiect de lege privind...</td>
    // Adjust selector based on actual layout.
    let title = $('table tr td font b').first().text().trim() || $('title').text().trim();
    if (!title) {
        title = "Titlu Necunoscut";
    }

    // Extract Registration Number
    // E.g. "PL-x nr. 123/2024" or "L123/2024"
    // Assuming it's located near the title or in a specific row
    const allText = $('body').text();
    const regNumMatch = allText.match(/(?:PL-x nr\.|L)\s*(\d+\/\d{4})/i);
    const registrationNumber = regNumMatch ? regNumMatch[0].trim() : 'N/A';

    // Parse "Traseu legislativ" (Chronological list of events)
    const statusHistory: StatusHistoryEntry[] = [];
    
    // Often it's a table with multiple rows where the first column is date and second is the event
    // E.g. <tr><td>12 oct. 2024</td><td>Inregistrat la Senat</td></tr>
    $('table').each((i: number, table: any) => {
        const tableText = $(table).text().toLowerCase();
        if (tableText.includes('traseu legislativ') || tableText.includes('derularea procedurii')) {
             $(table).find('tr').each((j: number, tr: any) => {
                 const tds = $(tr).find('td');
                 if (tds.length >= 2) {
                     const dateText = $(tds[0]).text().trim();
                     const eventText = $(tds[1]).text().trim();
                     
                     if (dateText.match(/^\d{1,2}\s+[a-z]+\.\s+\d{4}$/i)) {
                         statusHistory.push({
                             statusLabel: eventText,
                             timestamp: parseRomanianDate(dateText),
                             location: 'Camera Deputaților',
                         });
                     }
                 }
             });
        }
    });
    
    // Extract Voting PDF links or tables
    // Voting PDFs are usually linked with text "Vot" or "Stenograma"
    const votingLinks: string[] = [];
    $('a').each((i: number, el: any) => {
        const href = $(el).attr('href');
        const text = $(el).text().toLowerCase();
        if (href && (text.includes('vot') || href.toLowerCase().includes('.pdf'))) {
            votingLinks.push(href.startsWith('http') ? href : `${BASE_URL}${href}`);
        }
    });
    
    if (votingLinks.length > 0) {
        statusHistory.push({
            statusLabel: `Vot înregistrat (vezi documente)`,
            timestamp: new Date().toISOString(), // Use current or parsed date
            location: 'Camera Deputaților',
        });
    }

    const currentStatus = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1].statusLabel : 'Înregistrat';

    const result: LegislativeJSON = {
        law: {
            title,
            registrationNumber,
            currentStatus,
            chamber: 'CDEP' as Chamber,
            originalUrl: url,
        },
        statusHistory,
    };

    return result;
  } catch (error) {
    console.error(`Failed to parse detail page ${url}:`, error);
    return null;
  }
}

async function main() {
    console.log('Starting scraper...');
    const results: LegislativeJSON[] = [];
    
    try {
        console.log(`Fetching listing from ${LISTING_URL}`);
        // To not overwhelm the server, just do a dummy link or fetch the actual list
        const projectUrls = await scrapeListingPage(LISTING_URL);
        
        console.log(`Found ${projectUrls.length} projects. Processing first 5 for demonstration...`);
        
        const urlsToProcess = projectUrls.slice(0, 5);
        if (urlsToProcess.length === 0) {
             console.log("No URLs found, or we're simulating.");
             // Simulating a run if the network request is blocked or structure changed
             urlsToProcess.push(`${BASE_URL}/pls/proiecte/upl_pck.proiect?idp=12345`);
        }

        for (const url of urlsToProcess) {
            const data = await scrapeDetailPage(url);
            if (data) {
                results.push(data);
            }
            // Polite scraping: wait a bit between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Output to JSON file
        const outDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(outDir)) {
             fs.mkdirSync(outDir);
        }
        
        const outFile = path.join(outDir, `scraped_data_${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf-8');
        
        console.log(`Successfully scraped ${results.length} projects.`);
        console.log(`Data written to ${outFile}`);
        
    } catch (error) {
        console.error('Scraper failed:', error);
        process.exit(1);
    }
}

// Run the script
main();
