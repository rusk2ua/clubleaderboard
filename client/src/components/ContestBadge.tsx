import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";

interface ContestBadgeProps {
  contest: string;
  mode?: string;
}

const modeColors: Record<string, string> = {
  CW: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  SSB: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  RTTY: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  MIXED: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
};

export function ContestBadge({ contest, mode }: ContestBadgeProps) {
  const modeColor = modeColors[mode || "MIXED"] || modeColors.MIXED;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="font-mono">
        <Radio className="h-3 w-3 mr-1" />
        {contest}
      </Badge>
      {mode && (
        <Badge variant="outline" className={modeColor}>
          {mode}
        </Badge>
      )}
    </div>
  );
}
