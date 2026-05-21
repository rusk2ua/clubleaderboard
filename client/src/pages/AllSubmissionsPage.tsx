import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Radio, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AllSubmissionsPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const callsign = searchParams.get('callsign');
  const yearParam = searchParams.get('year');

  const { data, isLoading } = useQuery({
    queryKey: ["/api/submissions", callsign, yearParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (callsign) params.append('callsign', callsign);
      if (yearParam) params.append('year', yearParam);
      const res = await fetch(`/api/submissions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const submissions = data?.submissions || [];
  const yearDisplay = yearParam ? `${yearParam} season` : 'all years';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Club Awards Program</h1>
          </div>
          <Button variant="ghost" onClick={() => window.history.back()} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            {callsign ? `Submissions by ${callsign}` : 'All Submissions'}
          </h2>
          <p className="text-muted-foreground">
            {isLoading ? "Loading..." : `Showing ${submissions.length} submissions for ${yearDisplay}`}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading submissions...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No submissions found</div>
        ) : (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Contest</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead className="text-right">Claimed Score</TableHead>
                  <TableHead className="text-right">Individual</TableHead>
                  <TableHead className="text-right">Club Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub: any) => (
                  <TableRow 
                    key={`${sub.id}-${sub.memberCallsign}`} 
                    className="hover-elevate"
                    data-testid={`row-submission-${sub.id}`}
                  >
                    <TableCell className="font-mono font-semibold" data-testid={`text-year-${sub.id}`}>
                      {sub.contestYear}
                    </TableCell>
                    <TableCell className="font-semibold" data-testid={`text-contest-${sub.id}`}>
                      {sub.contestKey}
                    </TableCell>
                    <TableCell>{sub.mode}</TableCell>
                    <TableCell className="font-mono font-semibold">
                      {sub.callsign}
                    </TableCell>
                    <TableCell className="font-mono font-semibold" data-testid={`text-operator-${sub.id}`}>
                      {sub.memberCallsign}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {sub.claimedScore.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Math.round(sub.individualClaimed).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-primary">
                      {Math.round(sub.normalizedPoints).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
