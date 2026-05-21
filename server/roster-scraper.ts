import https from 'https';
import { getRosterUrl } from './club-config';

interface RosterMember {
  callsign: string;
  firstName: string;
  lastName: string;
  duesExpiration: string;
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    }).on('error', (err) => { reject(err); });
  });
}

export async function fetchClubRoster(): Promise<RosterMember[]> {
  try {
    const rosterUrl = await getRosterUrl();

    if (!rosterUrl) {
      console.error('Roster URL not configured. Set roster_domain and roster_path in /skipper.');
      return [];
    }

    console.log(`Starting roster fetch from ${rosterUrl}...`);
    const html = await httpsGet(rosterUrl);
    console.log(`Fetched HTML length: ${html.length} bytes`);
    
    const members: RosterMember[] = [];
    
    // Try multiple regex patterns to handle different HTML formats
    const patterns = [
      // Pattern 1: With optional attributes
      /<tr[^>]*>\s*<td[^>]*>([A-Z0-9\/]+)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/gi,
      // Pattern 2: Simpler pattern
      /<tr>\s*<td>([A-Z0-9\/]+)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<\/tr>/gi,
      // Pattern 3: Handle multiline
      /<tr[^>]*>[\s\n]*<td[^>]*>([A-Z0-9\/]+)<\/td>[\s\n]*<td[^>]*>([^<]*)<\/td>[\s\n]*<td[^>]*>([^<]*)<\/td>[\s\n]*<td[^>]*>([^<]*)<\/td>[\s\n]*<\/tr>/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const [, callsign, firstName, lastName, duesDate] = match;
        
        if (callsign && callsign.trim()) {
          const member = {
            callsign: callsign.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            duesExpiration: duesDate.trim(),
          };
          
          // Avoid duplicates
          if (!members.find(m => m.callsign === member.callsign)) {
            members.push(member);
          }
        }
      }
      
      if (members.length > 0) {
        console.log(`Successfully parsed ${members.length} members using pattern ${patterns.indexOf(pattern) + 1}`);
        break;
      }
    }
    
    if (members.length === 0) {
      console.error('No members parsed. HTML sample:');
      console.error(html.substring(0, 1000));
      console.error('---');
      // Try to find any table rows
      const anyRows = html.match(/<tr[^>]*>.*?<\/tr>/gi);
      console.error(`Found ${anyRows?.length || 0} <tr> tags total`);
      if (anyRows && anyRows.length > 0) {
        console.error('First row:', anyRows[0]);
      }
    }
    
    return members;
  } catch (error) {
    console.error('Error fetching club roster:', error);
    throw error;
  }
}

export function isDuesValidForYear(duesExpiration: string, year: number): boolean {
  if (!duesExpiration) return false;
  
  const parts = duesExpiration.split('/');
  if (parts.length !== 3) return false;
  
  const [month, day, expirationYear] = parts.map(p => parseInt(p, 10));
  
  if (isNaN(expirationYear) || isNaN(month) || isNaN(day)) return false;
  
  const expirationDate = new Date(expirationYear, month - 1, day);
  const requiredDate = new Date(year, 11, 31);
  
  return expirationDate >= requiredDate;
}
