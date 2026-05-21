import { ContestResultsTable } from "@/components/ContestResultsTable";
import { ContestBadge } from "@/components/ContestBadge";
import { Radio, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export default function ContestDetailPage() {
  const params = useParams();
  const contestKey = params.key?.toUpperCase() || "";
  
  const urlParams = new URLSearchParams(window.location.search);
  const yearParam = urlParams.get("year");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/contest", contestKey, yearParam],
    queryFn: async () => {
      // If year is specified, use it. Otherwise, let the API find the most recent year
      const url = yearParam 
        ? `/api/contest/${contestKey}?year=${yearParam}`
        : `/api/contest/${contestKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch contest details");
      return res.json();
    },
    enabled: !!contestKey,
  });

  const results = data?.results || [];
  const participants = results.reduce((sum: number, r: any) => sum + (r.effectiveOperators || 0), 0);
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
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading contest details...</div>
        ) : (
          <>
            <div className="mb-8">
              <ContestBadge contest={contestKey} />
              <h2 className="text-3xl font-bold mt-4 mb-6">
                Contest Results
                {data?.seasonYear ? ` - ${data.seasonYear}` : ' - All Years'}
              </h2>

              <div className="mb-8">
                <Card className="p-6 max-w-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {data?.seasonYear ? 'Participants' : 'Total Participants (All Years)'}
                    </p>
                  </div>
                  <p className="text-xl font-semibold" data-testid="text-participants">{participants}</p>
                </Card>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold">
                  {data?.seasonYear ? `${data.seasonYear} Submissions` : 'All Submissions'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Club Points to 1M maximum
                </p>
              </div>
              {results.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No submissions yet for this contest.</p>
                </Card>
              ) : (
                <ContestResultsTable results={results} />
              )}
            </div>

            <div className="mt-8 p-6 rounded-lg border border-border bg-muted/30">
              <h4 className="font-semibold mb-3">Scoring Formula</h4>
              <div className="font-mono text-sm bg-background p-4 rounded border border-border">
                <p className="mb-2">Club Points = (Individual Claimed / Highest Single-Op) × 1,000,000</p>
                <p className="text-muted-foreground text-xs">
                  where Individual Claimed = Claimed Score / Total Operators
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
