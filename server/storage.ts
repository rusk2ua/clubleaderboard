import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, desc, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  Member,
  InsertMember,
  Submission,
  InsertSubmission,
  RawLog,
  InsertRawLog,
  Baseline,
  InsertBaseline,
  OperatorPoints,
  InsertOperatorPoints,
  CheerleaderPoints,
  InsertCheerleaderPoints,
  ScoringConfig,
  InsertScoringConfig,
} from "@shared/schema";

const client = neon(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });

export interface IStorage {
  getMember(callsign: string): Promise<Member | undefined>;
  getAllActiveMembers(): Promise<Member[]>;
  getEligibleMembers(seasonYear: number): Promise<Member[]>;
  createMember(member: InsertMember): Promise<Member>;
  createManyMembers(members: InsertMember[]): Promise<void>;
  deleteAllMembers(): Promise<void>;

  createSubmission(submission: InsertSubmission): Promise<Submission>;
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionDetails(id: number): Promise<any>;
  getActiveSubmissionsByContest(seasonYear: number, contestKey: string): Promise<Submission[]>;
  deactivateSubmission(callsign: string, contestKey: string, seasonYear: number): Promise<void>;
  getSeasonLeaderboard(seasonYear: number): Promise<any[]>;
  getAllTimeLeaderboard(): Promise<any[]>;
  getAvailableYears(): Promise<number[]>;
  getMemberContestHistory(callsign: string, seasonYear: number): Promise<any[]>;
  getContestResults(contestKey: string, seasonYear: number): Promise<any[]>;
  getAllSubmissions(seasonYear: number | undefined, memberCallsign?: string): Promise<any[]>;
  getSeasonStats(seasonYear: number): Promise<any>;
  getMostCompetitiveContests(limit: number, seasonYear?: number): Promise<any[]>;
  getMostActiveOperators(limit: number, seasonYear?: number): Promise<any[]>;
  getMostRecentLogs(limit: number): Promise<any[]>;

  createRawLog(log: InsertRawLog): Promise<RawLog>;

  getBaseline(seasonYear: number, contestKey: string): Promise<Baseline | undefined>;
  upsertBaseline(baseline: InsertBaseline): Promise<void>;

  createOperatorPoints(points: InsertOperatorPoints): Promise<OperatorPoints>;
  deleteOperatorPointsBySubmission(submissionId: number): Promise<void>;
  clearAllContestData(): Promise<void>;

  getScoringConfig(key: string): Promise<ScoringConfig | undefined>;
  setScoringConfig(config: InsertScoringConfig): Promise<void>;
  getAllUniqueContests(): Promise<Array<{ contestYear: number; contestKey: string; submissionCount: number }>>;
  getUniqueContestKeys(): Promise<string[]>;
  getContestYears(contestKey: string): Promise<number[]>;

  incrementCheerleaderPoints(memberCallsign: string, seasonYear: number, pointsPerSpot: number, spottedCallsign: string, frequency: string): Promise<void>;
  getCheerleaderPoints(memberCallsign: string, seasonYear: number): Promise<CheerleaderPoints | undefined>;
  getTopCheerleaders(limit: number, seasonYear?: number): Promise<any[]>;
  getAllCheerleaderPointsForMember(memberCallsign: string): Promise<CheerleaderPoints[]>;
}

export class DbStorage implements IStorage {
  async getMember(callsign: string): Promise<Member | undefined> {
    const result = await db.select().from(schema.members).where(eq(schema.members.callsign, callsign)).limit(1);
    return result[0];
  }

  async getAllActiveMembers(): Promise<Member[]> {
    return db.select().from(schema.members).where(eq(schema.members.activeYn, true));
  }

  async getEligibleMembers(seasonYear: number): Promise<Member[]> {
    const cutoffDate = `12/31/${seasonYear}`;
    return db
      .select()
      .from(schema.members)
      .where(
        and(
          eq(schema.members.activeYn, true),
          sql`${schema.members.duesExpiration} >= ${cutoffDate}`
        )
      )
      .orderBy(schema.members.callsign);
  }

  async createMember(member: InsertMember): Promise<Member> {
    const result = await db.insert(schema.members).values(member).returning();
    return result[0];
  }

  async createManyMembers(members: InsertMember[]): Promise<void> {
    if (members.length > 0) {
      await db.insert(schema.members).values(members).onConflictDoUpdate({
        target: schema.members.callsign,
        set: {
          activeYn: sql`EXCLUDED.active_yn`,
          aliases: sql`EXCLUDED.aliases`,
          firstName: sql`EXCLUDED.first_name`,
          lastName: sql`EXCLUDED.last_name`,
          duesExpiration: sql`EXCLUDED.dues_expiration`,
        },
      });
    }
  }

  async deleteAllMembers(): Promise<void> {
    await db.delete(schema.members);
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const result = await db.insert(schema.submissions).values(submission).returning();
    return result[0];
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    const result = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id)).limit(1);
    return result[0];
  }

  async getSubmissionDetails(id: number): Promise<any> {
    // Get submission details with operator points
    const submission = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id)).limit(1);
    if (!submission[0]) {
      return null;
    }

    const operators = await db
      .select({
        id: schema.operatorPoints.id,
        memberCallsign: schema.operatorPoints.memberCallsign,
        individualClaimed: schema.operatorPoints.individualClaimed,
        normalizedPoints: schema.operatorPoints.normalizedPoints,
      })
      .from(schema.operatorPoints)
      .where(eq(schema.operatorPoints.submissionId, id));

    return {
      ...submission[0],
      operators,
    };
  }

  async getActiveSubmissionsByContest(seasonYear: number, contestKey: string): Promise<Submission[]> {
    return db.select().from(schema.submissions).where(
      and(
        eq(schema.submissions.seasonYear, seasonYear),
        eq(schema.submissions.contestKey, contestKey),
        eq(schema.submissions.isActive, true)
      )
    );
  }

  async deactivateSubmission(callsign: string, contestKey: string, seasonYear: number): Promise<void> {
    await db.update(schema.submissions)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.submissions.callsign, callsign),
          eq(schema.submissions.contestKey, contestKey),
          eq(schema.submissions.seasonYear, seasonYear),
          eq(schema.submissions.isActive, true)
        )
      );
  }

  async getSeasonLeaderboard(seasonYear: number): Promise<any[]> {
    const result = await db
      .select({
        callsign: schema.operatorPoints.memberCallsign,
        contestPoints: sql<number>`ROUND(SUM(${schema.operatorPoints.normalizedPoints}))`,
        cheerleaderPoints: sql<number>`COALESCE(${schema.cheerleaderPoints.cheerleaderPoints}, 0)`,
        contests: sql<number>`COUNT(DISTINCT ${schema.submissions.contestKey})`,
        totalClaimed: sql<number>`SUM(${schema.operatorPoints.individualClaimed})`,
        totalLogs: sql<number>`CAST(COUNT(DISTINCT ${schema.operatorPoints.submissionId}) AS INTEGER)`,
      })
      .from(schema.operatorPoints)
      .innerJoin(schema.submissions, eq(schema.operatorPoints.submissionId, schema.submissions.id))
      .leftJoin(
        schema.cheerleaderPoints,
        and(
          eq(schema.operatorPoints.memberCallsign, schema.cheerleaderPoints.memberCallsign),
          eq(schema.cheerleaderPoints.seasonYear, seasonYear)
        )
      )
      .where(
        and(
          eq(schema.submissions.seasonYear, seasonYear),
          eq(schema.submissions.isActive, true)
        )
      )
      .groupBy(schema.operatorPoints.memberCallsign, schema.cheerleaderPoints.cheerleaderPoints)
      .orderBy(desc(sql`ROUND(SUM(${schema.operatorPoints.normalizedPoints})) + COALESCE(${schema.cheerleaderPoints.cheerleaderPoints}, 0)`));

    let currentRank = 1;
    let previousPoints: number | null = null;
    
    return result.map((row) => {
      const contestPoints = Number(row.contestPoints);
      const cheerPoints = Number(row.cheerleaderPoints);
      const totalPoints = contestPoints + cheerPoints;
      
      if (previousPoints !== null && totalPoints < previousPoints) {
        currentRank++;
      }
      previousPoints = totalPoints;
      
      return {
        rank: currentRank,
        callsign: row.callsign,
        contestPoints: contestPoints,
        cheerleaderPoints: cheerPoints,
        normalizedPoints: totalPoints, // Club Award Points
        contests: row.contests,
        claimedScore: row.totalClaimed,
        totalLogs: Number(row.totalLogs),
      };
    });
  }

  async getAllTimeLeaderboard(): Promise<any[]> {
    // First get contest points
    const contestPointsResult = await db
      .select({
        callsign: schema.operatorPoints.memberCallsign,
        contestPoints: sql<number>`ROUND(SUM(${schema.operatorPoints.normalizedPoints}))`,
        contests: sql<number>`COUNT(DISTINCT ${schema.submissions.seasonYear} || '_' || ${schema.submissions.contestKey})`,
        totalClaimed: sql<number>`SUM(${schema.operatorPoints.individualClaimed})`,
        totalLogs: sql<number>`CAST(COUNT(DISTINCT ${schema.operatorPoints.submissionId}) AS INTEGER)`,
      })
      .from(schema.operatorPoints)
      .innerJoin(schema.submissions, eq(schema.operatorPoints.submissionId, schema.submissions.id))
      .where(eq(schema.submissions.isActive, true))
      .groupBy(schema.operatorPoints.memberCallsign);

    // Get all cheerleader points totals
    const cheerleaderPointsResult = await db
      .select({
        callsign: schema.cheerleaderPoints.memberCallsign,
        cheerleaderPoints: sql<number>`SUM(${schema.cheerleaderPoints.cheerleaderPoints})`,
      })
      .from(schema.cheerleaderPoints)
      .groupBy(schema.cheerleaderPoints.memberCallsign);

    // Combine contest and cheerleader points
    const cheerleaderMap = new Map(
      cheerleaderPointsResult.map(r => [r.callsign, Number(r.cheerleaderPoints)])
    );

    const combined = contestPointsResult.map(row => ({
      callsign: row.callsign,
      contestPoints: Number(row.contestPoints),
      cheerleaderPoints: cheerleaderMap.get(row.callsign) || 0,
      contests: row.contests,
      totalClaimed: row.totalClaimed,
      totalLogs: Number(row.totalLogs),
    }));

    // Add members who only have cheerleader points (no contest submissions)
    for (const [callsign, cheerPoints] of Array.from(cheerleaderMap.entries())) {
      if (!combined.find(c => c.callsign === callsign)) {
        combined.push({
          callsign,
          contestPoints: 0,
          cheerleaderPoints: cheerPoints,
          contests: 0,
          totalClaimed: 0,
          totalLogs: 0,
        });
      }
    }

    // Sort by total points (Club Award Points)
    combined.sort((a, b) => {
      const totalA = a.contestPoints + a.cheerleaderPoints;
      const totalB = b.contestPoints + b.cheerleaderPoints;
      return totalB - totalA;
    });

    // Apply dense ranking
    let currentRank = 1;
    let previousPoints: number | null = null;
    
    return combined.map((row) => {
      const totalPoints = row.contestPoints + row.cheerleaderPoints;
      
      if (previousPoints !== null && totalPoints < previousPoints) {
        currentRank++;
      }
      previousPoints = totalPoints;
      
      return {
        rank: currentRank,
        callsign: row.callsign,
        contestPoints: row.contestPoints,
        cheerleaderPoints: row.cheerleaderPoints,
        normalizedPoints: totalPoints, // Club Award Points
        contests: row.contests,
        claimedScore: row.totalClaimed,
        totalLogs: row.totalLogs,
      };
    });
  }

  async getAvailableYears(): Promise<number[]> {
    const result = await db
      .selectDistinct({ year: schema.submissions.contestYear })
      .from(schema.submissions)
      .orderBy(desc(schema.submissions.contestYear));
    
    return result.map(r => r.year);
  }

  async getMemberContestHistory(callsign: string, seasonYear: number): Promise<any[]> {
    return db
      .select({
        contest: schema.submissions.contestKey,
        mode: schema.submissions.mode,
        claimed: schema.operatorPoints.individualClaimed,
        normalized: sql<number>`ROUND(${schema.operatorPoints.normalizedPoints})`,
        date: schema.submissions.submittedAt,
      })
      .from(schema.operatorPoints)
      .innerJoin(schema.submissions, eq(schema.operatorPoints.submissionId, schema.submissions.id))
      .where(
        and(
          eq(schema.operatorPoints.memberCallsign, callsign),
          eq(schema.submissions.seasonYear, seasonYear),
          eq(schema.submissions.isActive, true)
        )
      )
      .orderBy(desc(schema.submissions.submittedAt));
  }

  async getContestResults(contestKey: string, seasonYear: number): Promise<any[]> {
    const results = await db
      .select({
        contestYear: schema.submissions.contestYear,
        callsign: schema.submissions.callsign,
        mode: schema.submissions.mode,
        claimedScore: schema.submissions.claimedScore,
        totalOperators: schema.submissions.totalOperators,
        effectiveOperators: schema.submissions.effectiveOperators,
        submittedAt: schema.submissions.submittedAt,
        individualClaimed: sql<number>`MAX(${schema.operatorPoints.individualClaimed})`.as('individualClaimed'),
        normalizedPoints: sql<number>`ROUND(MAX(${schema.operatorPoints.normalizedPoints}))`.as('normalizedPoints'),
      })
      .from(schema.submissions)
      .leftJoin(schema.operatorPoints, eq(schema.submissions.id, schema.operatorPoints.submissionId))
      .where(
        and(
          eq(schema.submissions.contestKey, contestKey),
          eq(schema.submissions.seasonYear, seasonYear),
          eq(schema.submissions.isActive, true)
        )
      )
      .groupBy(
        schema.submissions.id,
        schema.submissions.contestYear,
        schema.submissions.callsign,
        schema.submissions.mode,
        schema.submissions.claimedScore,
        schema.submissions.totalOperators,
        schema.submissions.effectiveOperators,
        schema.submissions.submittedAt
      )
      .orderBy(desc(schema.submissions.claimedScore));

    return results.map(r => ({
      ...r,
      individualClaimed: r.individualClaimed ?? Math.round(r.claimedScore / (r.totalOperators || 1)),
      normalizedPoints: r.normalizedPoints ?? 0,
    }));
  }

  async getAllSubmissions(seasonYear: number | undefined, memberCallsign?: string): Promise<any[]> {
    const conditions = [
      eq(schema.submissions.isActive, true)
    ];

    if (seasonYear !== undefined) {
      conditions.push(eq(schema.submissions.seasonYear, seasonYear));
    }

    if (memberCallsign) {
      conditions.push(eq(schema.operatorPoints.memberCallsign, memberCallsign));
    }

    return db
      .select({
        id: schema.submissions.id,
        contestYear: schema.submissions.contestYear,
        contestKey: schema.submissions.contestKey,
        mode: schema.submissions.mode,
        callsign: schema.submissions.callsign,
        memberCallsign: schema.operatorPoints.memberCallsign,
        claimedScore: schema.submissions.claimedScore,
        individualClaimed: schema.operatorPoints.individualClaimed,
        normalizedPoints: sql<number>`ROUND(${schema.operatorPoints.normalizedPoints})`,
        submittedAt: schema.submissions.submittedAt,
      })
      .from(schema.submissions)
      .innerJoin(schema.operatorPoints, eq(schema.submissions.id, schema.operatorPoints.submissionId))
      .where(and(...conditions))
      .orderBy(desc(schema.submissions.submittedAt));
  }

  async createRawLog(log: InsertRawLog): Promise<RawLog> {
    const result = await db.insert(schema.rawLogs).values(log).returning();
    return result[0];
  }

  async getBaseline(seasonYear: number, contestKey: string): Promise<Baseline | undefined> {
    const result = await db.select().from(schema.baselines).where(
      and(
        eq(schema.baselines.seasonYear, seasonYear),
        eq(schema.baselines.contestKey, contestKey)
      )
    ).limit(1);
    return result[0];
  }

  async upsertBaseline(baseline: InsertBaseline): Promise<void> {
    await db.insert(schema.baselines).values(baseline).onConflictDoUpdate({
      target: [schema.baselines.seasonYear, schema.baselines.contestKey],
      set: {
        highestSingleClaimed: baseline.highestSingleClaimed,
      },
    });
  }

  async createOperatorPoints(points: InsertOperatorPoints): Promise<OperatorPoints> {
    const result = await db.insert(schema.operatorPoints).values(points).returning();
    return result[0];
  }

  async batchCreateOperatorPoints(pointsArray: InsertOperatorPoints[]): Promise<void> {
    if (pointsArray.length === 0) return;
    // Batch insert all operator points at once for better performance
    await db.insert(schema.operatorPoints).values(pointsArray);
  }

  async deleteOperatorPointsBySubmission(submissionId: number): Promise<void> {
    await db.delete(schema.operatorPoints).where(eq(schema.operatorPoints.submissionId, submissionId));
  }

  async deleteAllOperatorPointsForContest(seasonYear: number, contestKey: string): Promise<void> {
    // Delete all operator points for submissions in this contest/year
    const contestSubmissions = await db.select({ id: schema.submissions.id })
      .from(schema.submissions)
      .where(and(
        eq(schema.submissions.seasonYear, seasonYear),
        eq(schema.submissions.contestKey, contestKey),
        eq(schema.submissions.isActive, true)
      ));
    
    const submissionIds = contestSubmissions.map(s => s.id);
    if (submissionIds.length > 0) {
      await db.delete(schema.operatorPoints)
        .where(sql`${schema.operatorPoints.submissionId} IN ${submissionIds}`);
    }
  }

  async clearAllContestData(): Promise<void> {
    await db.delete(schema.operatorPoints);
    await db.delete(schema.rawLogs);
    await db.delete(schema.submissions);
    await db.delete(schema.baselines);
  }

  async getSeasonStats(seasonYear: number): Promise<any> {
    const allMembers = await db.select().from(schema.members);
    
    const eligibleMembers = allMembers.filter(m => {
      if (!m.duesExpiration) return false;
      const parts = m.duesExpiration.split('/');
      if (parts.length !== 3) return false;
      const [month, day, expirationYear] = parts.map(p => parseInt(p, 10));
      if (isNaN(expirationYear) || isNaN(month) || isNaN(day)) return false;
      const expirationDate = new Date(expirationYear, month - 1, day);
      const requiredDate = new Date(seasonYear, 11, 31);
      return expirationDate >= requiredDate;
    });

    const activeSubmissions = await db.select({
      memberOperators: schema.submissions.memberOperators,
    }).from(schema.submissions)
      .where(and(
        eq(schema.submissions.seasonYear, seasonYear),
        eq(schema.submissions.isActive, true)
      ));

    const activeCallsigns = new Set<string>();
    activeSubmissions.forEach(sub => {
      if (sub.memberOperators) {
        sub.memberOperators.split(',').forEach(op => activeCallsigns.add(op.trim()));
      }
    });

    const uniqueContests = await db.select({
      contestKey: schema.submissions.contestKey,
      submissionCount: sql<number>`CAST(COUNT(DISTINCT ${schema.submissions.id}) AS INTEGER)`.as('submission_count'),
    }).from(schema.submissions)
      .where(and(
        eq(schema.submissions.seasonYear, seasonYear),
        eq(schema.submissions.isActive, true)
      ))
      .groupBy(schema.submissions.contestKey)
      .orderBy(schema.submissions.contestKey);

    return {
      activeMembers: activeCallsigns.size,
      eligibleMembers: eligibleMembers.length,
      contests: uniqueContests.map(c => ({
        contestKey: c.contestKey,
        submissionCount: Number(c.submissionCount),
      })),
    };
  }

  async getAllContests(): Promise<any[]> {
    // Get all contests across all years with total submission counts
    const allContests = await db.select({
      contestKey: schema.submissions.contestKey,
      submissionCount: sql<number>`CAST(COUNT(DISTINCT ${schema.submissions.id}) AS INTEGER)`.as('submission_count'),
    }).from(schema.submissions)
      .where(eq(schema.submissions.isActive, true))
      .groupBy(schema.submissions.contestKey)
      .orderBy(schema.submissions.contestKey);

    return allContests.map(c => ({
      contestKey: c.contestKey,
      submissionCount: Number(c.submissionCount),
    }));
  }

  async getMostCompetitiveContests(limit: number, seasonYear?: number): Promise<any[]> {
    // Get contests with most submissions for specific year or all-time
    // Include all contests that tie with the 5th highest submission count
    const whereConditions = [
      eq(schema.submissions.isActive, true)
    ];
    
    if (seasonYear) {
      whereConditions.push(eq(schema.submissions.seasonYear, seasonYear));
    }
    
    const results = await db
      .select({
        contestKey: schema.submissions.contestKey,
        submissionCount: sql<number>`CAST(COUNT(DISTINCT ${schema.submissions.id}) AS INTEGER)`.as('submission_count'),
        operatorCount: sql<number>`CAST(COUNT(DISTINCT ${schema.operatorPoints.memberCallsign}) AS INTEGER)`.as('operator_count'),
      })
      .from(schema.submissions)
      .innerJoin(schema.operatorPoints, eq(schema.submissions.id, schema.operatorPoints.submissionId))
      .where(and(...whereConditions))
      .groupBy(schema.submissions.contestKey)
      .orderBy(desc(sql`submission_count`))
      .limit(100); // Get more than needed to handle ties

    // Find the submission count of the 5th place (or last if fewer than 5)
    const fifthPlaceCount = Number(results[Math.min(limit - 1, results.length - 1)]?.submissionCount) || 0;
    
    // Include all contests with submission counts >= 5th place count
    const filtered = results.filter(r => Number(r.submissionCount) >= fifthPlaceCount);

    return filtered.map(r => ({
      contestKey: r.contestKey,
      submissionCount: Number(r.submissionCount),
      operatorCount: Number(r.operatorCount),
    }));
  }

  async getMostActiveOperators(limit: number, seasonYear?: number): Promise<any[]> {
    // Get operators with most submitted logs for specific year or all-time
    // Include all operators that tie with the 5th highest entry count
    const whereConditions = [
      eq(schema.submissions.isActive, true)
    ];
    
    if (seasonYear) {
      whereConditions.push(eq(schema.submissions.seasonYear, seasonYear));
    }
    
    const results = await db
      .select({
        callsign: schema.operatorPoints.memberCallsign,
        totalScore: sql<number>`CAST(ROUND(SUM(${schema.operatorPoints.normalizedPoints})) AS INTEGER)`.as('total_score'),
        entryCount: sql<number>`CAST(COUNT(DISTINCT ${schema.operatorPoints.submissionId}) AS INTEGER)`.as('entry_count'),
      })
      .from(schema.operatorPoints)
      .innerJoin(schema.submissions, eq(schema.operatorPoints.submissionId, schema.submissions.id))
      .where(and(...whereConditions))
      .groupBy(schema.operatorPoints.memberCallsign)
      .orderBy(desc(sql`entry_count`))
      .limit(100); // Get more than needed to handle ties

    // Find the entry count of the 5th place (or last if fewer than 5)
    const fifthPlaceCount = Number(results[Math.min(limit - 1, results.length - 1)]?.entryCount) || 0;
    
    // Include all operators with entry counts >= 5th place count
    const filtered = results.filter(r => Number(r.entryCount) >= fifthPlaceCount);

    return filtered.map(r => ({
      callsign: r.callsign,
      totalScore: Number(r.totalScore),
      entryCount: Number(r.entryCount),
    }));
  }

  async getMostRecentLogs(limit: number): Promise<any[]> {
    // Get the most recent accepted submissions with member operators regardless of year
    const results = await db
      .select({
        id: schema.operatorPoints.id,
        submissionId: schema.operatorPoints.submissionId,
        memberCallsign: schema.operatorPoints.memberCallsign,
        stationCallsign: schema.submissions.callsign,
        contestKey: schema.submissions.contestKey,
        seasonYear: schema.submissions.seasonYear,
        submittedAt: schema.submissions.submittedAt,
      })
      .from(schema.operatorPoints)
      .innerJoin(schema.submissions, eq(schema.operatorPoints.submissionId, schema.submissions.id))
      .where(eq(schema.submissions.isActive, true))
      .orderBy(desc(schema.submissions.submittedAt))
      .limit(limit);

    // Return early if no results
    if (results.length === 0) {
      return [];
    }

    // Get total all-time points for each operator
    const callsigns = results.map(r => r.memberCallsign);
    const operatorTotals = await db
      .select({
        callsign: schema.operatorPoints.memberCallsign,
        totalScore: sql<number>`CAST(ROUND(SUM(${schema.operatorPoints.normalizedPoints})) AS INTEGER)`.as('total_score'),
      })
      .from(schema.operatorPoints)
      .innerJoin(schema.submissions, eq(schema.operatorPoints.submissionId, schema.submissions.id))
      .where(
        and(
          eq(schema.submissions.isActive, true),
          sql`${schema.operatorPoints.memberCallsign} IN ${callsigns}`
        )
      )
      .groupBy(schema.operatorPoints.memberCallsign);

    const totalsMap = new Map(operatorTotals.map(t => [t.callsign, Number(t.totalScore)]));

    return results.map(r => ({
      id: r.id,
      submissionId: r.submissionId,
      operatorCallsign: r.memberCallsign,
      stationCallsign: r.stationCallsign,
      contestKey: r.contestKey,
      seasonYear: r.seasonYear,
      submittedAt: r.submittedAt,
      totalScore: totalsMap.get(r.memberCallsign) || 0,
    }));
  }

  async getScoringConfig(key: string): Promise<ScoringConfig | undefined> {
    const result = await db.select().from(schema.scoringConfig).where(eq(schema.scoringConfig.key, key)).limit(1);
    return result[0];
  }

  async setScoringConfig(config: InsertScoringConfig): Promise<void> {
    await db.insert(schema.scoringConfig).values(config).onConflictDoUpdate({
      target: schema.scoringConfig.key,
      set: {
        value: config.value,
        updatedAt: sql`NOW()`,
      },
    });
  }

  async getAllUniqueContests(): Promise<Array<{ contestYear: number; contestKey: string; submissionCount: number }>> {
    const results = await db
      .select({
        contestYear: schema.submissions.contestYear,
        contestKey: schema.submissions.contestKey,
        submissionCount: sql<number>`COUNT(DISTINCT ${schema.submissions.id})`.as('submission_count'),
      })
      .from(schema.submissions)
      .where(eq(schema.submissions.isActive, true))
      .groupBy(schema.submissions.contestYear, schema.submissions.contestKey)
      .orderBy(
        desc(schema.submissions.contestYear),
        schema.submissions.contestKey
      );
    
    return results;
  }

  async getUniqueContestKeys(): Promise<string[]> {
    const results = await db
      .selectDistinct({
        contestKey: schema.submissions.contestKey,
      })
      .from(schema.submissions)
      .where(eq(schema.submissions.isActive, true))
      .orderBy(schema.submissions.contestKey);
    
    return results.map(r => r.contestKey);
  }

  async getContestYears(contestKey: string): Promise<number[]> {
    const results = await db
      .select({
        contestYear: schema.submissions.contestYear,
      })
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.contestKey, contestKey),
          eq(schema.submissions.isActive, true)
        )
      )
      .groupBy(schema.submissions.contestYear)
      .orderBy(desc(schema.submissions.contestYear));
    
    return results.map(r => r.contestYear);
  }

  async incrementCheerleaderPoints(
    memberCallsign: string, 
    seasonYear: number, 
    pointsPerSpot: number,
    spottedCallsign: string,
    frequency: string
  ): Promise<void> {
    const existing = await this.getCheerleaderPoints(memberCallsign, seasonYear);
    
    // Record individual spot
    await db.insert(schema.cheerleaderSpots).values({
      memberCallsign,
      spottedCallsign,
      frequency,
      pointsAwarded: pointsPerSpot,
    });
    
    if (existing) {
      // Update existing record
      await db
        .update(schema.cheerleaderPoints)
        .set({
          totalSpots: existing.totalSpots + 1,
          cheerleaderPoints: existing.cheerleaderPoints + pointsPerSpot,
        })
        .where(
          and(
            eq(schema.cheerleaderPoints.memberCallsign, memberCallsign),
            eq(schema.cheerleaderPoints.seasonYear, seasonYear)
          )
        );
    } else {
      // Create new record
      await db.insert(schema.cheerleaderPoints).values({
        memberCallsign,
        seasonYear,
        totalSpots: 1,
        cheerleaderPoints: pointsPerSpot,
      });
    }
  }

  async getCheerleaderPoints(memberCallsign: string, seasonYear: number): Promise<CheerleaderPoints | undefined> {
    const result = await db
      .select()
      .from(schema.cheerleaderPoints)
      .where(
        and(
          eq(schema.cheerleaderPoints.memberCallsign, memberCallsign),
          eq(schema.cheerleaderPoints.seasonYear, seasonYear)
        )
      )
      .limit(1);
    
    return result[0];
  }

  async getTopCheerleaders(limit: number, seasonYear?: number): Promise<any[]> {
    // Calculate 48-hour threshold timestamp
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    // Get 48-hour spots grouped by member
    const recentSpotsResults = await db
      .select({
        memberCallsign: schema.cheerleaderSpots.memberCallsign,
        spotsLast48h: sql<number>`COUNT(*)`.as('spots_last_48h'),
        pointsLast48h: sql<number>`COALESCE(SUM(${schema.cheerleaderSpots.pointsAwarded}), 0)`.as('points_last_48h'),
      })
      .from(schema.cheerleaderSpots)
      .where(sql`${schema.cheerleaderSpots.spottedAt} >= ${fortyEightHoursAgo}`)
      .groupBy(schema.cheerleaderSpots.memberCallsign)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(100);
    
    // Count total spots in cheerleader_spots to check if we have enough data
    const totalSpotsInTracking = await db
      .select({ count: sql<number>`COUNT(*)`.as('count') })
      .from(schema.cheerleaderSpots)
      .where(sql`${schema.cheerleaderSpots.spottedAt} >= ${fortyEightHoursAgo}`);
    
    const spotsCount = Number(totalSpotsInTracking[0]?.count || 0);
    const hasEnoughTrackingData = spotsCount >= 20;
    
    // If no recent activity OR insufficient data in cheerleader_spots table, fall back to all-time data
    // This handles the transition period where the new tracking table is being populated
    if (recentSpotsResults.length === 0 || !hasEnoughTrackingData) {
      const currentYear = new Date().getFullYear();

      const allTimeResults = await db
        .select({
          memberCallsign: schema.cheerleaderPoints.memberCallsign,
          totalSpots: sql<number>`SUM(${schema.cheerleaderPoints.totalSpots})`.as('total_spots'),
          cheerleaderPoints: sql<number>`SUM(${schema.cheerleaderPoints.cheerleaderPoints})`.as('cheerleader_points'),
        })
        .from(schema.cheerleaderPoints)
        .groupBy(schema.cheerleaderPoints.memberCallsign)
        .orderBy(desc(sql`SUM(${schema.cheerleaderPoints.totalSpots})`));

      if (allTimeResults.length === 0) {
        return [];
      }

      // Find the spot count at the Nth position (dense ranking)
      const thresholdIndex = Math.min(limit - 1, allTimeResults.length - 1);
      const thresholdSpots = Number(allTimeResults[thresholdIndex].totalSpots);
      
      // Include ALL members with spots >= threshold (handles ties)
      const filteredResults = allTimeResults.filter(r => Number(r.totalSpots) >= thresholdSpots);

      // Get member details and contest points
      // Since we have no timestamp data, use all-time totals for both 48h and all-time display
      const cheerleaders = await Promise.all(
        filteredResults.map(async (c) => {
          const member = await this.getMember(c.memberCallsign);

          const contestPointsQuery = await db
            .select({
              totalPoints: sql<number>`COALESCE(SUM(${schema.operatorPoints.normalizedPoints}), 0)`.as('total_points'),
            })
            .from(schema.operatorPoints)
            .innerJoin(
              schema.submissions,
              and(
                eq(schema.operatorPoints.submissionId, schema.submissions.id),
                eq(schema.submissions.isActive, true)
              )
            )
            .where(eq(schema.operatorPoints.memberCallsign, c.memberCallsign));

          const contestPoints = Math.round(Number(contestPointsQuery[0]?.totalPoints || 0));
          const allTimeCheerPoints = Number(c.cheerleaderPoints);
          const allTimeSpots = Number(c.totalSpots);
          
          // Use all-time totals as proxy for 48h until real timestamp data is available
          // Display will show "N / N" format until cluster populates cheerleader_spots table
          return {
            memberCallsign: c.memberCallsign,
            firstName: member?.firstName || '',
            lastName: member?.lastName || '',
            totalSpots: allTimeSpots,
            cheerleaderPoints: allTimeCheerPoints,
            spotsLast48h: allTimeSpots, // Use all-time as proxy
            pointsLast48h: allTimeCheerPoints, // Use all-time as proxy
            contestPoints: contestPoints,
            totalScore: contestPoints + allTimeCheerPoints,
          };
        })
      );

      return cheerleaders;
    }

    // Get the 48h spot count at the limit position
    const limitThreshold = recentSpotsResults[Math.min(limit - 1, recentSpotsResults.length - 1)].spotsLast48h;

    // Include all results that tie with or exceed the threshold
    const filteredResults = recentSpotsResults.filter(r => Number(r.spotsLast48h) >= Number(limitThreshold));

    // Get member details, overall cheerleader points, and contest points for each
    const cheerleaders = await Promise.all(
      filteredResults.map(async (c) => {
        const member = await this.getMember(c.memberCallsign);
        
        // Get overall cheerleader stats (all-time or season-specific)
        const whereConditions = [];
        if (seasonYear) {
          whereConditions.push(eq(schema.cheerleaderPoints.seasonYear, seasonYear));
        }
        whereConditions.push(eq(schema.cheerleaderPoints.memberCallsign, c.memberCallsign));
        
        const overallCheerStats = seasonYear
          ? await db
              .select({
                totalSpots: schema.cheerleaderPoints.totalSpots,
                cheerleaderPoints: schema.cheerleaderPoints.cheerleaderPoints,
              })
              .from(schema.cheerleaderPoints)
              .where(and(...whereConditions))
          : await db
              .select({
                totalSpots: sql<number>`SUM(${schema.cheerleaderPoints.totalSpots})`.as('total_spots'),
                cheerleaderPoints: sql<number>`SUM(${schema.cheerleaderPoints.cheerleaderPoints})`.as('cheerleader_points'),
              })
              .from(schema.cheerleaderPoints)
              .where(and(...whereConditions))
              .groupBy(schema.cheerleaderPoints.memberCallsign);
        
        // Calculate total contest points (all-time or season-specific)
        const contestPointsQuery = seasonYear
          ? await db
              .select({
                totalPoints: sql<number>`COALESCE(SUM(${schema.operatorPoints.normalizedPoints}), 0)`.as('total_points'),
              })
              .from(schema.operatorPoints)
              .innerJoin(
                schema.submissions,
                and(
                  eq(schema.operatorPoints.submissionId, schema.submissions.id),
                  eq(schema.submissions.isActive, true)
                )
              )
              .where(
                and(
                  eq(schema.operatorPoints.memberCallsign, c.memberCallsign),
                  eq(schema.submissions.seasonYear, seasonYear)
                )
              )
          : await db
              .select({
                totalPoints: sql<number>`COALESCE(SUM(${schema.operatorPoints.normalizedPoints}), 0)`.as('total_points'),
              })
              .from(schema.operatorPoints)
              .innerJoin(
                schema.submissions,
                and(
                  eq(schema.operatorPoints.submissionId, schema.submissions.id),
                  eq(schema.submissions.isActive, true)
                )
              )
              .where(eq(schema.operatorPoints.memberCallsign, c.memberCallsign));

        const contestPoints = Math.round(Number(contestPointsQuery[0]?.totalPoints || 0));
        const overallCheerPoints = Number(overallCheerStats[0]?.cheerleaderPoints || 0);
        const overallSpots = Number(overallCheerStats[0]?.totalSpots || 0);
        
        return {
          memberCallsign: c.memberCallsign,
          firstName: member?.firstName || '',
          lastName: member?.lastName || '',
          totalSpots: overallSpots,
          cheerleaderPoints: overallCheerPoints,
          spotsLast48h: Number(c.spotsLast48h),
          pointsLast48h: Number(c.pointsLast48h),
          contestPoints: contestPoints,
          totalScore: contestPoints + overallCheerPoints,
        };
      })
    );

    return cheerleaders;
  }

  async getAllCheerleaderPointsForMember(memberCallsign: string): Promise<CheerleaderPoints[]> {
    return db
      .select()
      .from(schema.cheerleaderPoints)
      .where(eq(schema.cheerleaderPoints.memberCallsign, memberCallsign))
      .orderBy(desc(schema.cheerleaderPoints.seasonYear));
  }
}

export const storage = new DbStorage();
