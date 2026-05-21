import { MemberCard } from "@/components/MemberCard";
import { ContestBadge } from "@/components/ContestBadge";
import { Radio, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// TODO: remove mock data
const mockMember = {
  callsign: "K1AR",
  totalPoints: 1000000,
  rank: 1,
  contests: 8,
};

const mockContestHistory = [
  { contest: "CQWW", mode: "CW", claimed: 5420000, normalized: 1000000, date: "2025-11-28" },
  { contest: "CQWW", mode: "SSB", claimed: 4980000, normalized: 918821, date: "2025-10-26" },
  { contest: "ARRLDX", mode: "CW", claimed: 3200000, normalized: 890000, date: "2025-02-15" },
  { contest: "ARRLDX", mode: "SSB", claimed: 2800000, normalized: 765000, date: "2025-03-02" },
  { contest: "CQWPX", mode: "CW", claimed: 2600000, normalized: 720000, date: "2025-05-25" },
  { contest: "CQWPX", mode: "SSB", claimed: 2400000, normalized: 680000, date: "2025-03-30" },
  { contest: "IARU", mode: "MIXED", claimed: 1900000, normalized: 540000, date: "2025-07-13" },
  { contest: "SWEEPSTAKES", mode: "CW", claimed: 1650000, normalized: 485000, date: "2025-11-02" },
];

export default function MemberDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Club Awards Program</h1>
          </div>
          <Link href="/">
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Scoreboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-8">
          <MemberCard
            callsign={mockMember.callsign}
            totalPoints={mockMember.totalPoints}
            rank={mockMember.rank}
            contests={mockMember.contests}
          />
        </div>

        <div>
          <h3 className="text-2xl font-semibold mb-6">Contest History</h3>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contest</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Claimed Score</TableHead>
                  <TableHead className="text-right">Club Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockContestHistory.map((entry, idx) => (
                  <TableRow key={idx} className="hover-elevate">
                    <TableCell>
                      <ContestBadge contest={entry.contest} mode={entry.mode} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.claimed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-primary">
                      {entry.normalized.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
