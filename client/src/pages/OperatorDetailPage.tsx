import { Radio, ArrowLeft, Trophy, Award, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function OperatorDetailPage() {
  const params = useParams();
  const callsign = params.callsign?.toUpperCase() || "";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/operator", callsign],
    queryFn: async () => {
      const res = await fetch(`/api/operator/${callsign}`);
      if (!res.ok) throw new Error("Failed to fetch operator details");
      return res.json();
    },
    enabled: !!callsign,
  });

  const submissions = data?.submissions || [];
  const totalPoints = data?.totalPoints || 0;
  const rank = data?.rank || 0;
  const totalContests = data?.totalContests || 0;
  const member = data?.member;

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
          <div className="text-center text-muted-foreground py-12">Loading operator details...</div>
        ) : (
          <>
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-3xl font-bold font-mono" data-testid="text-operator-callsign">{callsign}</h2>
                {member && (
                  <Badge variant="outline" data-testid="badge-member-status">
                    {member.activeYn ? "Active Member" : "Inactive"}
                  </Badge>
                )}
              </div>
              
              {member && (member.firstName || member.lastName) && (
                <p className="text-lg text-muted-foreground mb-6" data-testid="text-operator-name">
                  {member.firstName} {member.lastName}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Award className="h-5 w-5 text-primary" />
                    <p className="text-sm text-muted-foreground">All-Time Rank</p>
                  </div>
                  <p className="text-2xl font-bold font-mono" data-testid="text-operator-rank">
                    {rank > 0 ? `#${rank}` : "—"}
                  </p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <p className="text-sm text-muted-foreground">Total Club Points</p>
                  </div>
                  <p className="text-2xl font-bold font-mono" data-testid="text-operator-points">
                    {totalPoints.toLocaleString()}
                  </p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <p className="text-sm text-muted-foreground">Total Contests</p>
                  </div>
                  <p className="text-2xl font-bold font-mono" data-testid="text-operator-contests">
                    {totalContests}
                  </p>
                </Card>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold">All Submissions</h3>
                <p className="text-sm text-muted-foreground">
                  {submissions.length} total entries
                </p>
              </div>
              {submissions.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No submissions yet for this operator.</p>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="table-operator-submissions">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Year</th>
                          <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Contest</th>
                          <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Mode</th>
                          <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Station</th>
                          <th className="px-6 py-4 text-sm font-semibold text-muted-foreground text-right">Individual Points</th>
                          <th className="px-6 py-4 text-sm font-semibold text-muted-foreground text-right">Club Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map((sub: any, index: number) => (
                          <tr key={sub.id} className="border-b hover-elevate" data-testid={`row-submission-${index}`}>
                            <td className="px-6 py-4 font-mono text-sm" data-testid={`cell-year-${index}`}>
                              {sub.contestYear}
                            </td>
                            <td className="px-6 py-4 font-mono font-semibold" data-testid={`cell-contest-${index}`}>
                              {sub.contestKey}
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground" data-testid={`cell-mode-${index}`}>
                              {sub.mode}
                            </td>
                            <td className="px-6 py-4 font-mono" data-testid={`cell-callsign-${index}`}>
                              {sub.callsign}
                            </td>
                            <td className="px-6 py-4 text-right font-mono" data-testid={`cell-individual-${index}`}>
                              {sub.individualClaimed?.toLocaleString() || "—"}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-semibold" data-testid={`cell-normalized-${index}`}>
                              {sub.normalizedPoints?.toLocaleString() || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            <div className="mt-8 p-6 rounded-lg border border-border bg-muted/30">
              <h4 className="font-semibold mb-3">About Club Points</h4>
              <p className="text-sm text-muted-foreground">
                Club Points are calculated using the formula: (Individual Claimed / Highest Single-Op) × 1,000,000.
                Individual Claimed = Claimed Score / Total Operators. Points are aggregated across all contests for 
                the all-time leaderboard.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
