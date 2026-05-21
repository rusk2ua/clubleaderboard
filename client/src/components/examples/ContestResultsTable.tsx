import { ContestResultsTable } from "../ContestResultsTable";

export default function ContestResultsTableExample() {
  const mockResults = [
    { callsign: "K1AR", claimedScore: 5420000, individualClaimed: 5420000, normalizedPoints: 1000000, effectiveOperators: 1, status: "accepted" as const },
    { callsign: "W1WEF", claimedScore: 4980000, individualClaimed: 4980000, normalizedPoints: 918821, effectiveOperators: 1, status: "accepted" as const },
    { callsign: "K1TTT", claimedScore: 3200000, individualClaimed: 1600000, normalizedPoints: 295203, effectiveOperators: 2, status: "accepted" as const },
    { callsign: "N1UR", claimedScore: 2400000, individualClaimed: 2400000, normalizedPoints: 442804, effectiveOperators: 1, status: "processing" as const },
  ];

  return (
    <div className="p-8 bg-background">
      <ContestResultsTable results={mockResults} />
    </div>
  );
}
