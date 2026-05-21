import { ContestBadge } from "../ContestBadge";

export default function ContestBadgeExample() {
  return (
    <div className="p-8 bg-background space-y-4">
      <ContestBadge contest="CQWW" mode="CW" />
      <ContestBadge contest="ARRLDX" mode="SSB" />
      <ContestBadge contest="CQWPX" mode="RTTY" />
    </div>
  );
}
