import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";

interface ScoreboardEntry {
  rank: number;
  callsign: string;
  claimedScore: number;
  contestPoints?: number;
  cheerleaderPoints?: number;
  normalizedPoints: number;
  contests: number;
}

interface ScoreboardTableProps {
  entries: ScoreboardEntry[];
}

export function ScoreboardTable({ entries }: ScoreboardTableProps) {
  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Rank</TableHead>
            <TableHead>Callsign</TableHead>
            <TableHead className="text-right">Contests</TableHead>
            <TableHead className="text-right">Claimed Pts</TableHead>
            <TableHead className="text-right">Contest Pts</TableHead>
            <TableHead className="text-right">Cheer Pts</TableHead>
            <TableHead className="text-right">Award Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.callsign} className="hover-elevate" data-testid={`row-scoreboard-${entry.callsign}`}>
              <TableCell className="font-medium">
                <span className={entry.rank <= 3 ? "text-primary font-semibold" : ""}>
                  {entry.rank}
                </span>
              </TableCell>
              <TableCell className="font-mono font-semibold" data-testid={`text-callsign-${entry.callsign}`}>
                {entry.callsign}
              </TableCell>
              <TableCell className="text-right font-mono">
                <Link href={`/submissions?callsign=${entry.callsign}`}>
                  <button className="hover:text-primary hover:underline" data-testid={`link-contests-${entry.callsign}`}>
                    {entry.contests}
                  </button>
                </Link>
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {Math.round(entry.claimedScore).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {Math.round(entry.contestPoints || 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {Math.round(entry.cheerleaderPoints || 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold text-primary">
                <Link href={`/submissions?callsign=${entry.callsign}`}>
                  <button className="hover:underline" data-testid={`link-points-${entry.callsign}`}>
                    {Math.round(entry.normalizedPoints).toLocaleString()}
                  </button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
