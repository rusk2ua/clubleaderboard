import { storage } from "./storage";
import type { Submission, Member } from "@shared/schema";
import { isDuesValidForYear } from "./roster-scraper";
import { getClubName } from "./club-config";

export type ScoringMethod = 'fixed' | 'participant-based';

export async function getScoringMethod(): Promise<ScoringMethod> {
  const config = await storage.getScoringConfig('scoring_method');
  return (config?.value as ScoringMethod) || 'fixed';
}

export async function calculateMaxPoints(
  seasonYear: number,
  contestKey: string,
  cachedSubmissions?: any[]
): Promise<number> {
  const method = await getScoringMethod();
  
  if (method === 'fixed') {
    return 1000000;
  }
  
  // participant-based: 50,000 points per submitted log, max 1,000,000
  // Use cached submissions if provided to avoid duplicate query
  const submissions = cachedSubmissions || await storage.getActiveSubmissionsByContest(seasonYear, contestKey);
  
  const logCount = submissions.length;
  
  // 50,000 points per log, max 1,000,000
  return Math.min(logCount * 50000, 1000000);
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  memberOperators?: string[];
  effectiveOperators?: number;
  excludedOperators?: string[];
  excludedReason?: string;
}

export async function validateSubmission(
  callsign: string,
  operators: string[],
  club: string,
  categoryOperator: string,
  seasonYear: number
): Promise<ValidationResult> {
  const clubName = await getClubName();

  // Validate club field if a club name is configured (via env var or DB override).
  // If neither is set the system is unconfigured — reject submissions with a clear message.
  if (!clubName) {
    return {
      valid: false,
      error: 'No club name is configured. Set CLUB_NAME in your environment variables or configure it in the Admin panel before submitting logs.',
    };
  }

  const normalizedClub = club.trim().toUpperCase();
  const expectedClub   = clubName.trim().toUpperCase();

  if (normalizedClub !== expectedClub) {
    return {
      valid: false,
      error: `CLUB field must be '${clubName}' (found: '${club}')`,
    };
  }

  const allMembers = await storage.getAllActiveMembers();
  const memberMap = new Map<string, Member>();
  
  allMembers.forEach(member => {
    memberMap.set(member.callsign.toUpperCase(), member);
    if (member.aliases) {
      const aliases = member.aliases.split(',').map(a => a.trim().toUpperCase());
      aliases.forEach(alias => {
        if (alias) memberMap.set(alias, member);
      });
    }
  });

  const memberOperators: string[] = [];
  const operatorsToCheck = operators.length > 0 ? operators : [callsign];
  const expiredDuesOperators: string[] = [];

  for (const op of operatorsToCheck) {
    const normalizedOp = op.toUpperCase();
    if (memberMap.has(normalizedOp)) {
      const member = memberMap.get(normalizedOp)!;
      
      // Separate operators by dues status
      if (!member.duesExpiration || !isDuesValidForYear(member.duesExpiration, seasonYear)) {
        expiredDuesOperators.push(member.callsign);
      } else if (!memberOperators.includes(member.callsign)) {
        memberOperators.push(member.callsign);
      }
    }
  }

  // Only reject if NO operators have valid dues
  if (memberOperators.length === 0) {
    if (expiredDuesOperators.length > 0) {
      return {
        valid: false,
        error: `All operators have expired dues for ${seasonYear}: ${expiredDuesOperators.join(', ')}. At least one operator must have current dues through 12/31/${seasonYear}.`,
      };
    }
    return {
      valid: false,
      error: `No club member operators found in submission.`,
    };
  }

  const isMultiOp = categoryOperator.includes('MULTI') || 
                    categoryOperator.includes('M/') ||
                    categoryOperator === 'CHECKLOG';

  // Multi-op: Just inform about excluded operators, don't reject
  // Points will be split among valid operators only

  const effectiveOperators = isMultiOp ? memberOperators.length : 1;

  return {
    valid: true,
    memberOperators,
    effectiveOperators,
    excludedOperators: expiredDuesOperators.length > 0 ? expiredDuesOperators : undefined,
    excludedReason: expiredDuesOperators.length > 0 
      ? `The following operators were excluded due to expired dues for ${seasonYear}: ${expiredDuesOperators.join(', ')}. They must have current dues through 12/31/${seasonYear}.`
      : undefined,
  };
}

export async function computeNormalizedPoints(
  submission: Submission,
  seasonYear: number
): Promise<number> {
  const individualClaimed = submission.claimedScore / submission.totalOperators;
  const maxPoints = await calculateMaxPoints(seasonYear, submission.contestKey);

  const baseline = await storage.getBaseline(seasonYear, submission.contestKey);
  
  if (!baseline || !baseline.highestSingleClaimed || baseline.highestSingleClaimed === 0) {
    // No baseline exists yet - calculate from all submissions
    const allSubmissions = await storage.getActiveSubmissionsByContest(
      seasonYear,
      submission.contestKey
    );
    
    // Guard against empty submissions array
    if (allSubmissions.length === 0) {
      return 0;
    }
    
    // Reference score = highest individual claimed score from ALL submissions
    const maxIndividualScore = Math.max(...allSubmissions.map(s => s.claimedScore / s.totalOperators));
    
    // Handle zero or negative reference score edge case
    if (maxIndividualScore <= 0) {
      // Store zero baseline
      await storage.upsertBaseline({
        seasonYear,
        contestKey: submission.contestKey,
        highestSingleClaimed: 0,
      });
      return 0;
    }
    
    // Store the exact reference score (no rounding) for accurate normalization
    await storage.upsertBaseline({
      seasonYear,
      contestKey: submission.contestKey,
      highestSingleClaimed: maxIndividualScore,
    });
    
    const normalizedPoints = (individualClaimed / maxIndividualScore) * maxPoints;
    // Clamp to [0, maxPoints] range
    return Math.max(0, Math.min(normalizedPoints, maxPoints));
  }

  // If stored baseline is zero, all scores should be zero
  if (baseline.highestSingleClaimed <= 0) {
    return 0;
  }

  const normalizedPoints = (individualClaimed / baseline.highestSingleClaimed) * maxPoints;
  // Clamp to [0, maxPoints] range
  return Math.max(0, Math.min(normalizedPoints, maxPoints));
}

export async function recomputeBaseline(
  seasonYear: number,
  contestKey: string,
  cachedSubmissions?: any[]
): Promise<void> {
  // Use cached submissions if provided to avoid duplicate query
  const submissions = cachedSubmissions || await storage.getActiveSubmissionsByContest(seasonYear, contestKey);
  
  if (submissions.length === 0) {
    return;
  }

  // Pass submissions to avoid re-querying for participant-based scoring
  const maxPoints = await calculateMaxPoints(seasonYear, contestKey, submissions);
  
  // Reference score = highest individual claimed score from ALL submissions
  const maxIndividualScore = Math.max(...submissions.map(s => s.claimedScore / s.totalOperators));
  
  // Handle zero or negative reference score edge case
  if (maxIndividualScore <= 0) {
    // Store zero baseline
    await storage.upsertBaseline({
      seasonYear,
      contestKey,
      highestSingleClaimed: 0,
    });
    
    // Delete operator points but don't insert any (all would be 0)
    await storage.deleteAllOperatorPointsForContest(seasonYear, contestKey);
    
    // Create zero-point entries for tracking
    const operatorPointsToInsert: any[] = [];
    for (const sub of submissions) {
      const memberOps = sub.memberOperators?.split(',') || [];
      for (const memberCall of memberOps) {
        operatorPointsToInsert.push({
          submissionId: sub.id,
          memberCallsign: memberCall.trim(),
          individualClaimed: 0,
          normalizedPoints: 0,
        });
      }
    }
    await storage.batchCreateOperatorPoints(operatorPointsToInsert);
    return;
  }
  
  // Store the exact reference score (no rounding) for accurate normalization
  await storage.upsertBaseline({
    seasonYear,
    contestKey,
    highestSingleClaimed: maxIndividualScore,
  });

  // OPTIMIZATION: Delete all operator points for contest at once, then batch insert
  await storage.deleteAllOperatorPointsForContest(seasonYear, contestKey);
  
  // Build array of all operator points to insert
  const operatorPointsToInsert: any[] = [];
  for (const sub of submissions) {
    const memberOps = sub.memberOperators?.split(',') || [];
    const individualClaimed = sub.claimedScore / sub.totalOperators;
    const normalizedPoints = (individualClaimed / maxIndividualScore) * maxPoints;
    
    for (const memberCall of memberOps) {
      operatorPointsToInsert.push({
        submissionId: sub.id,
        memberCallsign: memberCall.trim(),
        individualClaimed: Math.round(individualClaimed),
        // Clamp to [0, maxPoints] range and round
        normalizedPoints: Math.round(Math.max(0, Math.min(normalizedPoints, maxPoints))),
      });
    }
  }
  
  // Batch insert all operator points at once
  await storage.batchCreateOperatorPoints(operatorPointsToInsert);
}
