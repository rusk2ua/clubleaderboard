import { storage } from "./storage";
import { fetchClubRoster } from "./roster-scraper";
import { broadcast } from "./websocket";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export async function syncRoster() {
  try {
    console.log("Starting automatic roster sync...");
    const rosterMembers = await fetchClubRoster();
    
    if (rosterMembers.length === 0) {
      console.error("Roster sync failed - no members found");
      return false;
    }
    
    const members = rosterMembers.map(m => ({
      callsign: m.callsign.toUpperCase(),
      activeYn: true,
      aliases: '',
      firstName: m.firstName,
      lastName: m.lastName,
      duesExpiration: m.duesExpiration,
    }));

    await storage.deleteAllMembers();
    await storage.createManyMembers(members);

    broadcast("roster:synced", {
      count: members.length,
      automatic: true,
    });

    console.log(`Roster sync complete - ${members.length} members synced`);
    return true;
  } catch (error) {
    console.error("Automatic roster sync error:", error);
    return false;
  }
}

export async function startScheduler() {
  console.log("Starting roster sync scheduler - will run daily at this time");
  
  console.log("Running initial roster sync on startup...");
  await syncRoster();
  
  setInterval(async () => {
    await syncRoster();
  }, TWENTY_FOUR_HOURS);
}
