/**
 * club-config.ts
 *
 * Single source of truth for club identity configuration.
 * Resolution order (highest wins):
 *   1. DB override  — value stored in scoring_config by an admin via /skipper
 *   2. Env var      — CLUB_NAME / ROSTER_DOMAIN / ROSTER_PATH set at deploy time
 *   3. Empty string — unconfigured; callers handle this case explicitly
 */

import { storage } from './storage';

export interface ClubConfig {
  clubName: string;
  rosterDomain: string;
  rosterPath: string;
  /** Which keys are overridden in the DB (vs falling back to env var) */
  overrides: {
    clubName: boolean;
    rosterDomain: boolean;
    rosterPath: boolean;
  };
  /** True only when clubName has a non-empty effective value */
  configured: boolean;
}

function envClubName(): string {
  return (process.env.CLUB_NAME || '').trim();
}

function envRosterDomain(): string {
  return (process.env.ROSTER_DOMAIN || '').trim();
}

function envRosterPath(): string {
  return (process.env.ROSTER_PATH || '').trim();
}

/** Resolve a single config key: DB value wins over env fallback. */
async function resolve(key: string, envValue: string): Promise<{ value: string; fromDb: boolean }> {
  const row = await storage.getScoringConfig(key);
  if (row?.value && row.value.trim() !== '') {
    return { value: row.value.trim(), fromDb: true };
  }
  return { value: envValue, fromDb: false };
}

/** Full resolved config — used by API routes and the admin panel. */
export async function getClubConfig(): Promise<ClubConfig> {
  const [nameResult, domainResult, pathResult] = await Promise.all([
    resolve('club_name',     envClubName()),
    resolve('roster_domain', envRosterDomain()),
    resolve('roster_path',   envRosterPath()),
  ]);
  return {
    clubName:     nameResult.value,
    rosterDomain: domainResult.value,
    rosterPath:   pathResult.value,
    overrides: {
      clubName:     nameResult.fromDb,
      rosterDomain: domainResult.fromDb,
      rosterPath:   pathResult.fromDb,
    },
    configured: nameResult.value !== '',
  };
}

/** Convenience: just the effective club name. */
export async function getClubName(): Promise<string> {
  const { clubName } = await getClubConfig();
  return clubName;
}

/** Convenience: full roster URL, or null if domain is not configured. */
export async function getRosterUrl(): Promise<string | null> {
  const { rosterDomain, rosterPath } = await getClubConfig();
  if (!rosterDomain) return null;
  const cleanDomain = rosterDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanPath   = (rosterPath || '/').replace(/^([^/])/, '/$1');
  return `https://${cleanDomain}${cleanPath}`;
}
