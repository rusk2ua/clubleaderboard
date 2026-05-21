import { StatCard } from "../StatCard";
import { Trophy, Users, Radio } from "lucide-react";

export default function StatCardExample() {
  return (
    <div className="p-8 bg-background grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        title="Total Members"
        value={247}
        icon={Users}
        description="Active participants this season"
      />
      <StatCard
        title="Contests"
        value={12}
        icon={Radio}
        description="Completed this year"
      />
      <StatCard
        title="Top Score"
        value="1,000,000"
        icon={Trophy}
        description="Normalized points"
      />
    </div>
  );
}
