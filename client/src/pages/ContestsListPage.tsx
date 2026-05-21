import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ContestsListPage() {
  const { data: contestsData, isLoading } = useQuery({
    queryKey: ["/api/contests"],
    queryFn: async () => {
      const res = await fetch(`/api/contests`);
      if (!res.ok) throw new Error("Failed to fetch contests");
      return res.json();
    },
  });

  const contests = contestsData?.contests || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Radio className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Club Awards Program</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">All Contests Tracked</h2>
          <p className="text-muted-foreground">
            All contests with submissions across all years
          </p>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground">Loading contests...</div>
        ) : contests.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No contests tracked yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contests.map((contest: { contestKey: string; submissionCount: number }) => (
              <Card key={contest.contestKey} className="p-6" data-testid={`card-contest-${contest.contestKey}`}>
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/contest/${contest.contestKey}`} className="flex items-center gap-3 hover-elevate active-elevate-2 cursor-pointer p-2 -ml-2 rounded-md flex-1">
                    <Radio className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold font-mono">{contest.contestKey}</h3>
                    </div>
                  </Link>
                  <Link href={`/contest/${contest.contestKey}`} className="shrink-0" data-testid={`log-count-link-${contest.contestKey}`}>
                    <div className="flex items-center gap-1 hover:underline cursor-pointer text-primary font-mono">
                      <span className="text-lg font-bold">{contest.submissionCount}</span>
                      <span className="text-sm">{contest.submissionCount === 1 ? 'log' : 'logs'}</span>
                    </div>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
