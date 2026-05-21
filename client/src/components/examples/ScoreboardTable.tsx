import { ScoreboardTable } from "../ScoreboardTable";

export default function ScoreboardTableExample() {
  const mockEntries = [
    { rank: 1, callsign: "K1AR", claimedScore: 5420000, normalizedPoints: 1000000, contests: 8 },
    { rank: 2, callsign: "W1WEF", claimedScore: 4980000, normalizedPoints: 918821, contests: 7 },
    { rank: 3, callsign: "K1TTT", claimedScore: 4650000, normalizedPoints: 857895, contests: 6 },
    { rank: 4, callsign: "N1UR", claimedScore: 3890000, normalizedPoints: 717647, contests: 5 },
    { rank: 5, callsign: "W1XX", claimedScore: 3420000, normalizedPoints: 630952, contests: 6 },
  ];

  return (
    <div className="p-8 bg-background">
      <ScoreboardTable entries={mockEntries} />
    </div>
  );
}
