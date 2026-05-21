import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ContestResult {
  contestYear: number;
  callsign: string;
  mode: string;
  claimedScore: number;
  individualClaimed: number;
  normalizedPoints: number;
  effectiveOperators: number;
}

interface ContestResultsTableProps {
  results: ContestResult[];
}

export function ContestResultsTable({ results }: ContestResultsTableProps) {
  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead>Callsign</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead className="text-right">Eligible Operators</TableHead>
            <TableHead className="text-right">Claimed Score</TableHead>
            <TableHead className="text-right">Per Operator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result) => (
            <TableRow key={result.callsign} className="hover-elevate">
              <TableCell className="font-mono font-semibold" data-testid={`text-year-${result.callsign}`}>
                {result.contestYear}
              </TableCell>
              <TableCell className="font-mono font-semibold">
                {result.callsign}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {result.mode}
              </TableCell>
              <TableCell className="text-right font-mono">
                {result.effectiveOperators}
              </TableCell>
              <TableCell className="text-right font-mono">
                {result.claimedScore.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {Math.round(result.individualClaimed).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
