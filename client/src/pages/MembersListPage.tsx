import { useQuery } from "@tanstack/react-query";
import { Radio, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MembersListPage() {
  const currentYear = new Date().getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/members/eligible", currentYear],
    queryFn: async () => {
      const res = await fetch(`/api/members/eligible?year=${currentYear}`);
      if (!res.ok) throw new Error("Failed to fetch eligible members");
      return res.json();
    },
  });

  const members = data?.members || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Club Awards Program</h1>
          </div>
          <Button variant="ghost" onClick={() => window.history.back()} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Eligible Members</h2>
          <p className="text-muted-foreground">
            {isLoading ? "Loading..." : `Showing ${members.length} members with current dues for ${currentYear} season`}
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No eligible members found</div>
        ) : (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Callsign</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Dues Expiration</TableHead>
                  <TableHead>Aliases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member: any) => (
                  <TableRow 
                    key={member.callsign} 
                    className="hover-elevate"
                    data-testid={`row-member-${member.callsign}`}
                  >
                    <TableCell className="font-mono font-semibold" data-testid={`text-callsign-${member.callsign}`}>
                      {member.callsign}
                    </TableCell>
                    <TableCell>{member.firstName || '-'}</TableCell>
                    <TableCell>{member.lastName || '-'}</TableCell>
                    <TableCell data-testid={`text-dues-${member.callsign}`}>
                      {member.duesExpiration || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {member.aliases || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
