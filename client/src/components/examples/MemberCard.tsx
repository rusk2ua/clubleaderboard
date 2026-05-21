import { MemberCard } from "../MemberCard";

export default function MemberCardExample() {
  return (
    <div className="p-8 bg-background max-w-xl">
      <MemberCard
        callsign="K1AR"
        totalPoints={1000000}
        rank={1}
        contests={8}
      />
    </div>
  );
}
