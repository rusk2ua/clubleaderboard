import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Radio, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SubmissionDetailPage() {
  const { id } = useParams();
  
  const { data: submission, isLoading, error } = useQuery({
    queryKey: ["/api/submission", id],
    queryFn: async () => {
      const res = await fetch(`/api/submission/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error("Failed to fetch submission");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="text-center text-muted-foreground">Loading submission...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="text-center text-destructive">Failed to load submission. Please try again.</div>
        </main>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="text-center text-muted-foreground">Submission not found</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-submission-title">
            {submission.contestKey}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span data-testid="text-submission-year">{submission.contestYear}</span>
            </div>
            <div className="flex items-center gap-1">
              <Radio className="h-4 w-4" />
              <span data-testid="text-submission-mode">{submission.mode}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Submission Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Station Callsign</p>
                <p className="font-mono font-semibold text-lg" data-testid="text-station-callsign">{submission.callsign}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Claimed Score</p>
                <p className="font-mono font-semibold text-lg" data-testid="text-claimed-score">
                  {submission.claimedScore.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Operators</p>
                <p className="font-mono font-semibold" data-testid="text-operators">
                  {submission.operatorList || submission.operators?.map((op: any) => op.memberCallsign).join(', ')}
                </p>
              </div>
            </div>
          </Card>

          {submission.operators && submission.operators.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Operator Scoring</h2>
              </div>
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operator</TableHead>
                      <TableHead className="text-right">Individual Points</TableHead>
                      <TableHead className="text-right">Club Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submission.operators.map((op: any) => (
                      <TableRow key={op.id} data-testid={`row-operator-${op.memberCallsign}`}>
                        <TableCell className="font-mono font-semibold" data-testid={`text-operator-callsign-${op.memberCallsign}`}>
                          {op.memberCallsign}
                        </TableCell>
                        <TableCell className="text-right font-mono" data-testid={`text-individual-${op.memberCallsign}`}>
                          {Math.round(op.individualClaimed).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary" data-testid={`text-club-points-${op.memberCallsign}`}>
                          {Math.round(op.normalizedPoints).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
