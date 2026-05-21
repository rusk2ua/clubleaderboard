import { Card } from "@/components/ui/card";
import { User } from "lucide-react";

interface MemberCardProps {
  callsign: string;
  totalPoints: number;
  rank: number;
  contests: number;
}

export function MemberCard({ callsign, totalPoints, rank, contests }: MemberCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-mono font-bold" data-testid="text-member-callsign">
              {callsign}
            </h2>
            <p className="text-sm text-muted-foreground">
              Rank #{rank}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Total Points</p>
          <p className="text-2xl font-mono font-semibold text-primary" data-testid="text-total-points">
            {totalPoints.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Contests</p>
          <p className="text-2xl font-mono font-semibold">
            {contests}
          </p>
        </div>
      </div>
    </Card>
  );
}
