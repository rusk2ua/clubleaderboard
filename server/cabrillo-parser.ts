export interface CabrilloData {
  contest: string;
  callsign: string;
  claimedScore: number;
  categoryOperator: string;
  categoryAssisted: string;
  categoryTransmitter: string;
  categoryBand: string;
  categoryMode: string;
  mode: string;
  operators: string[];
  club: string;
  contestYear: number;
}

export interface ParsedCabrillo {
  success: boolean;
  data?: CabrilloData;
  error?: string;
}

function normalizeContestKey(contest: string): string {
  return contest.toUpperCase().trim();
}

function extractMode(categoryMode: string | undefined, contestName: string): string {
  if (categoryMode) {
    const mode = categoryMode.toUpperCase().trim();
    if (mode.includes('CW')) return 'CW';
    if (mode.includes('SSB') || mode.includes('PHONE')) return 'SSB';
    if (mode.includes('RTTY') || mode.includes('DIGITAL')) return 'RTTY';
    if (mode.includes('MIXED')) return 'MIXED';
    return mode;
  }
  
  const contestUpper = contestName.toUpperCase();
  if (contestUpper.includes('CW')) return 'CW';
  if (contestUpper.includes('SSB') || contestUpper.includes('PHONE')) return 'SSB';
  if (contestUpper.includes('RTTY')) return 'RTTY';
  
  return 'MIXED';
}

function parseOperators(operatorLine: string): string[] {
  return operatorLine
    .split(/[,\s]+/)
    .map(op => op.trim().toUpperCase())
    .filter(op => op.length > 0 && op.match(/^[A-Z0-9]+$/));
}

function computeScore(lines: string[]): number {
  let score = 0;
  for (const line of lines) {
    if (line.startsWith('QSO:')) {
      score++;
    }
  }
  return score * 2;
}

function extractContestYear(lines: string[]): number | null {
  // Find QSO records and extract year from date field
  // QSO format: QSO: freq mode date time call1 ... call2 ...
  // Example: QSO:   28009 CW 2024-12-14 0002 WJ1U 599 NH N9NC 599 NH
  
  for (const line of lines) {
    if (line.startsWith('QSO:')) {
      const parts = line.split(/\s+/).filter(p => p.length > 0);
      // Find date field (format: YYYY-MM-DD)
      for (const part of parts) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
          const year = parseInt(part.substring(0, 4), 10);
          if (year >= 1900 && year <= 2100) {
            return year;
          }
        }
      }
    }
  }
  
  // Fallback to current year if no QSO date found
  return new Date().getFullYear();
}

export function parseCabrillo(content: string): ParsedCabrillo {
  const lines = content.split('\n').map(line => line.trim());
  
  const data: Partial<CabrilloData> = {
    contest: '',
    callsign: '',
    claimedScore: 0,
    categoryOperator: '',
    categoryAssisted: '',
    categoryTransmitter: '',
    categoryBand: '',
    categoryMode: '',
    mode: '',
    operators: [],
    club: '',
    contestYear: 0,
  };

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;

    const [key, ...valueParts] = line.split(/:\s*/);
    const value = valueParts.join(':').trim();

    switch (key.toUpperCase()) {
      case 'CONTEST':
        data.contest = value;
        break;
      case 'CALLSIGN':
        data.callsign = value.toUpperCase();
        break;
      case 'CLAIMED-SCORE':
        data.claimedScore = parseInt(value, 10) || 0;
        break;
      case 'CATEGORY-OPERATOR':
        data.categoryOperator = value.toUpperCase();
        break;
      case 'CATEGORY-ASSISTED':
        data.categoryAssisted = value.toUpperCase();
        break;
      case 'CATEGORY-TRANSMITTER':
        data.categoryTransmitter = value.toUpperCase();
        break;
      case 'CATEGORY-BAND':
        data.categoryBand = value.toUpperCase();
        break;
      case 'CATEGORY-MODE':
        data.categoryMode = value.toUpperCase();
        break;
      case 'MODE':
        data.mode = value.toUpperCase();
        break;
      case 'OPERATORS':
        data.operators = parseOperators(value);
        break;
      case 'CLUB':
        // Pass the club field through as-is; the scoring engine validates it
        // against the configured club name stored in scoring_config.
        const clubUpper = value.toUpperCase();
        if (clubUpper.includes('YANKEE CLIPPER CONTEST CLUB') || clubUpper.includes('YCCC')) {
          data.club = 'Yankee Clipper Contest Club'; // update for your club if deploying elsewhere
        } else {
          data.club = value;
        }
        break;
    }
  }

  if (!data.contest) {
    return {
      success: false,
      error: 'Missing CONTEST field in Cabrillo file',
    };
  }

  if (!data.callsign) {
    return {
      success: false,
      error: 'Missing CALLSIGN field in Cabrillo file',
    };
  }

  if (data.claimedScore === 0) {
    data.claimedScore = computeScore(lines);
  }

  // Extract contest year from QSO records
  const contestYear = extractContestYear(lines);

  const normalizedContest = normalizeContestKey(data.contest);
  const extractedMode = extractMode(data.categoryMode || data.mode, data.contest);

  return {
    success: true,
    data: {
      contest: normalizedContest,
      callsign: data.callsign!,
      claimedScore: data.claimedScore!,
      categoryOperator: data.categoryOperator || 'SINGLE-OP',
      categoryAssisted: data.categoryAssisted || '',
      categoryTransmitter: data.categoryTransmitter || '',
      categoryBand: data.categoryBand || '',
      categoryMode: data.categoryMode || '',
      mode: extractedMode,
      operators: data.operators || [data.callsign!],
      club: data.club || '',
      contestYear: contestYear || new Date().getFullYear(),
    },
  };
}
