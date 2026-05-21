import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, description, className }: StatCardProps) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  
  return (
    <Card className={`p-6 ${className || ""}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-mono font-semibold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {displayValue}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-2">{description}</p>
          )}
        </div>
        {Icon && (
          <div className="ml-4">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
    </Card>
  );
}
