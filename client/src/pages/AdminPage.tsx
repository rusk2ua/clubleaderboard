import { useState } from "react";
import { Radio, Upload, Users, Settings, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminPage() {
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [emailCallsign, setEmailCallsign] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedContest, setSelectedContest] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMode, setSelectedMode] = useState("");
  
  const [clusterEnabled, setClusterEnabled] = useState(false);
  const [clusterFqdn, setClusterFqdn] = useState("");
  const [clusterPort, setClusterPort] = useState("");
  const [clusterCallsign, setClusterCallsign] = useState("");
  const [cheerleaderPoints, setCheerleaderPoints] = useState("");

  const [clubName, setClubName] = useState("");
  const [rosterDomain, setRosterDomain] = useState("");
  const [rosterPath, setRosterPath] = useState("");
  
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard?year=${currentYear}`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });

  const { data: scoringMethod } = useQuery({
    queryKey: ["/api/admin/scoring-method"],
    queryFn: async () => {
      const res = await fetch("/api/admin/scoring-method");
      if (!res.ok) throw new Error("Failed to fetch scoring method");
      return res.json();
    },
  });

  const { data: clusterConfig } = useQuery({
    queryKey: ["/api/admin/cluster-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cluster-config");
      if (!res.ok) throw new Error("Failed to fetch cluster config");
      const data = await res.json();
      setClusterEnabled(data.enabled);
      setClusterFqdn(data.fqdn);
      setClusterPort(String(data.port));
      setClusterCallsign(data.loginCallsign);
      setCheerleaderPoints(String(data.pointsPerSpot));
      return data;
    },
  });

  const { data: clubConfig } = useQuery({
    queryKey: ["/api/admin/club-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/club-config");
      if (!res.ok) throw new Error("Failed to fetch club config");
      const data = await res.json();
      // Populate inputs with effective values (DB override ?? env var)
      setClubName(data.clubName);
      setRosterDomain(data.rosterDomain);
      setRosterPath(data.rosterPath);
      return data as {
        clubName: string;
        rosterDomain: string;
        rosterPath: string;
        overrides: { clubName: boolean; rosterDomain: boolean; rosterPath: boolean };
        envDefaults: { clubName: string; rosterDomain: string; rosterPath: string };
      };
    },
  });

  const updateClubConfigMutation = useMutation({
    mutationFn: async (config: { clubName?: string; rosterDomain?: string; rosterPath?: string }) => {
      const res = await fetch("/api/admin/club-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to update club config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/club-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config/club"] });
      toast({ title: "Club configuration saved" });
    },
    onError: () => {
      toast({ title: "Failed to save club configuration", variant: "destructive" });
    },
  });

  const updateClusterConfigMutation = useMutation({
    mutationFn: async (config: {
      enabled?: boolean;
      fqdn?: string;
      port?: number;
      loginCallsign?: string;
      pointsPerSpot?: number;
    }) => {
      const res = await fetch("/api/admin/cluster-config", {
        method: "POST",
        body: JSON.stringify(config),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Update failed");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cluster-config"] });
      toast({
        title: "Cluster Config Updated",
        description: data.message || "Configuration has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    },
  });

  const { data: availableContests = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/contests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/contests");
      if (!res.ok) throw new Error("Failed to fetch contests");
      return res.json();
    },
  });

  const { data: availableYears = [] } = useQuery<number[]>({
    queryKey: ["/api/admin/contest-years", selectedContest],
    queryFn: async () => {
      if (!selectedContest) return [];
      const res = await fetch(`/api/admin/contest-years/${encodeURIComponent(selectedContest)}`);
      if (!res.ok) throw new Error("Failed to fetch years");
      return res.json();
    },
    enabled: !!selectedContest,
  });

  const updateScoringMethodMutation = useMutation({
    mutationFn: async (method: string) => {
      const res = await fetch("/api/admin/scoring-method", {
        method: "POST",
        body: JSON.stringify({ method }),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Update failed");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scoring-method"] });
      toast({
        title: "Scoring Method Updated",
        description: data.message || "Scoring method has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    },
  });

  const uploadRosterMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/admin/roster", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Roster Uploaded",
        description: `Successfully uploaded ${data.count} members`,
      });
      setRosterFile(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    },
  });

  const syncRosterMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/sync-roster", {
        method: "POST",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Sync failed");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Roster Synced",
        description: data.message || `Successfully synced ${data.count} members from yccc.org`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message,
      });
    },
  });

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/clear-data", {
        method: "POST",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Clear failed");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Database Cleared",
        description: data.message || "All contest data has been cleared. Member roster preserved.",
      });
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Clear Failed",
        description: error.message,
      });
    },
  });

  const recomputeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/recompute-all", {
        method: "POST",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Recompute failed");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({
        title: "Recompute Complete",
        description: data.message || `Successfully recomputed ${data.count} contest combinations`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Recompute Failed",
        description: error.message,
      });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: async (data: { file: File; contestKey: string; contestYear: string; mode: string }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("contestKey", data.contestKey);
      formData.append("contestYear", data.contestYear);
      formData.append("mode", data.mode);
      
      const res = await fetch("/api/admin/import-csv", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        try {
          const error = await res.json();
          throw new Error(error.error || "Import failed");
        } catch (e) {
          // If response isn't JSON, use status text
          throw new Error(`Import failed: ${res.statusText || res.status}`);
        }
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contest-years"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/insights/competitive-contests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Import Complete",
        description: data.message || `Successfully imported ${data.count} submissions`,
      });
      setCsvFile(null);
      setSelectedContest("");
      setSelectedYear("");
      setSelectedMode("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message,
      });
    },
  });

  const handleRosterUpload = () => {
    if (rosterFile) {
      uploadRosterMutation.mutate(rosterFile);
    }
  };

  const handleCsvImport = () => {
    if (csvFile && selectedContest && selectedYear && selectedMode) {
      importCsvMutation.mutate({ 
        file: csvFile, 
        contestKey: selectedContest, 
        contestYear: selectedYear,
        mode: selectedMode 
      });
    }
  };

  const stats = {
    totalSubmissions: leaderboard.reduce((sum: number, m: any) => sum + Number(m.contests || 0), 0),
    accepted: leaderboard.length,
    rejected: 0,
    processing: 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Club Admin Dashboard</h1>
          </div>
          <Button variant="outline" data-testid="button-logout">
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6">System Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Submissions"
              value={stats.totalSubmissions}
              icon={FileText}
            />
            <StatCard
              title="Accepted"
              value={stats.accepted}
              icon={Users}
            />
            <StatCard
              title="Rejected"
              value={stats.rejected}
              icon={FileText}
            />
            <StatCard
              title="Processing"
              value={stats.processing}
              icon={Settings}
            />
          </div>
        </div>

        <Tabs defaultValue="submissions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="submissions" data-testid="tab-submissions">
              Submissions
            </TabsTrigger>
            <TabsTrigger value="roster" data-testid="tab-roster">
              Member Roster
            </TabsTrigger>
            <TabsTrigger value="import" data-testid="tab-import">
              Import CSV
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold">Season Statistics</h3>
            </div>
            <div className="p-6 rounded-lg border border-border">
              <p className="text-muted-foreground mb-4">
                View detailed submissions in the contest detail pages from the main scoreboard
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-semibold">{stats.accepted}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Submissions</p>
                  <p className="text-2xl font-semibold">{stats.totalSubmissions}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="roster" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Sync from Club Website</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Automatically fetch the latest member roster from yccc.org/roster/ including dues expiration dates
              </p>

              <Button
                onClick={() => syncRosterMutation.mutate()}
                disabled={syncRosterMutation.isPending}
                data-testid="button-sync-roster"
              >
                {syncRosterMutation.isPending ? "Syncing..." : "Sync from Website"}
              </Button>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Manual Upload (Legacy)</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Upload a CSV file with columns: CALLSIGN, ACTIVE_YN, ALIAS_CALLS
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roster-file">Roster CSV File</Label>
                  <Input
                    id="roster-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setRosterFile(e.target.files?.[0] || null)}
                    data-testid="input-roster-file"
                  />
                </div>

                {rosterFile && (
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm font-medium">Selected: {rosterFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(rosterFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleRosterUpload}
                  disabled={!rosterFile || uploadRosterMutation.isPending}
                  data-testid="button-upload-roster"
                >
                  {uploadRosterMutation.isPending ? "Uploading..." : "Upload Roster"}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Current Roster Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Active Members</p>
                  <p className="text-2xl font-mono font-semibold">247</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="text-2xl font-semibold">Jan 1, 2025</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Import Historical Contest Data</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Import contest results from sponsor CSV files. Select an existing contest, mode, and upload the CSV file.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="input-contest">Contest Key</Label>
                  <Input
                    id="input-contest"
                    type="text"
                    placeholder="Enter contest key (e.g., CQ-WW-DX, ARRL-DX)"
                    value={selectedContest}
                    onChange={(e) => {
                      setSelectedContest(e.target.value);
                      setSelectedYear("");
                    }}
                    data-testid="input-contest"
                  />
                  {availableContests.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <p className="text-xs text-muted-foreground w-full">Quick select existing:</p>
                      {availableContests.map((contestKey: string) => (
                        <Button
                          key={contestKey}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedContest(contestKey);
                            setSelectedYear("");
                          }}
                          data-testid={`button-quick-contest-${contestKey}`}
                        >
                          {contestKey}
                        </Button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Enter the contest key exactly as it appears in the CONTEST field of Cabrillo logs
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="input-year">Contest Year</Label>
                  <Input
                    id="input-year"
                    type="number"
                    placeholder="Enter year (e.g., 2024)"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    min="1900"
                    max={currentYear + 1}
                    data-testid="input-year"
                  />
                  {availableYears.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <p className="text-xs text-muted-foreground w-full">Quick select existing:</p>
                      {availableYears.map((year: number) => (
                        <Button
                          key={year}
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedYear(String(year))}
                          data-testid={`button-quick-year-${year}`}
                        >
                          {year}
                        </Button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Enter the contest year
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="select-mode">Select Mode</Label>
                  <Select
                    value={selectedMode}
                    onValueChange={setSelectedMode}
                  >
                    <SelectTrigger id="select-mode" data-testid="select-mode">
                      <SelectValue placeholder="Choose mode..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CW" data-testid="option-mode-cw">CW</SelectItem>
                      <SelectItem value="SSB" data-testid="option-mode-ssb">SSB (Phone)</SelectItem>
                      <SelectItem value="MIXED" data-testid="option-mode-mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only CSV rows matching this mode will be imported
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="csv-file">CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    data-testid="input-csv-file"
                  />
                  <p className="text-xs text-muted-foreground">
                    Expected format: Station, Category, Mode, Score, Operators
                  </p>
                </div>

                {csvFile && (
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm font-medium">Selected: {csvFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(csvFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Import Notes</p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    <li>• Mode from dropdown will be applied to all entries</li>
                    <li>• Operators will be validated against current roster</li>
                    <li>• Only operators with current dues will be scored</li>
                    <li>• Duplicate submissions will deactivate previous entries</li>
                  </ul>
                </div>

                <Button
                  onClick={handleCsvImport}
                  disabled={!csvFile || !selectedContest || !selectedYear || !selectedMode || importCsvMutation.isPending}
                  data-testid="button-import-csv"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {importCsvMutation.isPending ? "Importing..." : "Import CSV"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="p-6 border-primary/40">
              <h3 className="text-xl font-semibold mb-1">Club Configuration</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Set your club's identity. Values from environment variables are used as defaults — you can override
                them here without redeploying. Leave a field blank to restore the environment variable default.
              </p>

              {!clubConfig?.clubName && (
                <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/40 flex items-start gap-3">
                  <span className="text-yellow-500 text-lg leading-none mt-0.5">⚠</span>
                  <div>
                    <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">Setup required</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      No club name is configured via environment variable or admin override.
                      Set <code className="bg-muted px-1 rounded">CLUB_NAME</code> in your environment,
                      or enter a value below.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Club Name */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="club-name">Club Name (Cabrillo CLUB field)</Label>
                    {clubConfig && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        clubConfig.overrides.clubName
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {clubConfig.overrides.clubName ? "DB override" : "env var"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="club-name"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      onBlur={() => updateClubConfigMutation.mutate({ clubName })}
                      placeholder={clubConfig?.envDefaults.clubName || "Yankee Clipper Contest Club"}
                      data-testid="input-club-name"
                    />
                    {clubConfig?.overrides.clubName && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                        onClick={() => {
                          updateClubConfigMutation.mutate({ clubName: "" });
                          setClubName(clubConfig.envDefaults.clubName);
                        }}
                      >
                        Clear override
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must match the <code className="bg-muted px-1 rounded">CLUB:</code> header in submitted
                    Cabrillo logs exactly (case-insensitive). Env var:{" "}
                    <code className="bg-muted px-1 rounded">CLUB_NAME</code>
                  </p>
                </div>

                {/* Roster Domain */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="roster-domain">Roster Domain</Label>
                    {clubConfig && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        clubConfig.overrides.rosterDomain
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {clubConfig.overrides.rosterDomain ? "DB override" : "env var"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="roster-domain"
                      value={rosterDomain}
                      onChange={(e) => setRosterDomain(e.target.value)}
                      onBlur={() => updateClubConfigMutation.mutate({ rosterDomain })}
                      placeholder={clubConfig?.envDefaults.rosterDomain || "yccc.org"}
                      data-testid="input-roster-domain"
                    />
                    {clubConfig?.overrides.rosterDomain && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                        onClick={() => {
                          updateClubConfigMutation.mutate({ rosterDomain: "" });
                          setRosterDomain(clubConfig.envDefaults.rosterDomain);
                        }}
                      >
                        Clear override
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Domain only — no https:// or trailing slash (e.g.{" "}
                    <code className="bg-muted px-1 rounded">yccc.org</code>). Env var:{" "}
                    <code className="bg-muted px-1 rounded">ROSTER_DOMAIN</code>
                  </p>
                </div>

                {/* Roster Path */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="roster-path">Roster URL Path</Label>
                    {clubConfig && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        clubConfig.overrides.rosterPath
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {clubConfig.overrides.rosterPath ? "DB override" : "env var"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="roster-path"
                      value={rosterPath}
                      onChange={(e) => setRosterPath(e.target.value)}
                      onBlur={() => updateClubConfigMutation.mutate({ rosterPath })}
                      placeholder={clubConfig?.envDefaults.rosterPath || "/roster/"}
                      data-testid="input-roster-path"
                    />
                    {clubConfig?.overrides.rosterPath && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                        onClick={() => {
                          updateClubConfigMutation.mutate({ rosterPath: "" });
                          setRosterPath(clubConfig.envDefaults.rosterPath);
                        }}
                      >
                        Clear override
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Path with leading and trailing slashes (e.g.{" "}
                    <code className="bg-muted px-1 rounded">/roster/</code>). Env var:{" "}
                    <code className="bg-muted px-1 rounded">ROSTER_PATH</code>
                    {(rosterDomain || clubConfig?.rosterDomain) && (
                      <> · Full URL:{" "}
                        <code className="bg-muted px-1 rounded text-primary">
                          https://{rosterDomain || clubConfig?.rosterDomain || "<domain>"}
                          {rosterPath || clubConfig?.rosterPath || "<path>"}
                        </code>
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium text-muted-foreground">
                    The roster is fetched automatically once per day on server startup. After saving new
                    roster settings, use the <strong>Sync from Club Website</strong> button above to pull
                    the latest member list immediately.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Scoring Method</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Configure how maximum Club points are calculated for contests
              </p>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="scoring-method">Scoring Method</Label>
                  <Select
                    value={scoringMethod?.method || 'fixed'}
                    onValueChange={(value) => updateScoringMethodMutation.mutate(value)}
                    disabled={updateScoringMethodMutation.isPending}
                  >
                    <SelectTrigger id="scoring-method" data-testid="select-scoring-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed" data-testid="option-fixed">
                        Fixed (1,000,000 points)
                      </SelectItem>
                      <SelectItem value="participant-based" data-testid="option-participant-based">
                        Participant-Based (50k per participant, max 1M)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">Current Method: {scoringMethod?.method === 'participant-based' ? 'Participant-Based' : 'Fixed'}</p>
                  <p className="text-xs text-muted-foreground">
                    {scoringMethod?.method === 'participant-based' 
                      ? 'Maximum points = min(participant count × 50,000, 1,000,000). Rewards participation in smaller contests.'
                      : 'Maximum points are always 1,000,000 regardless of participant count.'}
                  </p>
                  {scoringMethod?.updatedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last updated: {new Date(scoringMethod.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Note: After changing scoring method</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the "Recompute All Contests" button below to apply the new scoring method to all existing contest data.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">DX Cluster Configuration</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Configure the DX Cluster connection for awarding cheerleader points when members spot other club members
              </p>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="cluster-enabled">Enable DX Cluster Monitoring</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically award points when members spot other club members
                    </p>
                  </div>
                  <Switch
                    id="cluster-enabled"
                    checked={clusterEnabled}
                    onCheckedChange={(checked) => {
                      setClusterEnabled(checked);
                      updateClusterConfigMutation.mutate({ enabled: checked });
                    }}
                    data-testid="switch-cluster-enabled"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cluster-fqdn">Cluster FQDN</Label>
                  <Input
                    id="cluster-fqdn"
                    value={clusterFqdn}
                    onChange={(e) => setClusterFqdn(e.target.value)}
                    onBlur={() => updateClusterConfigMutation.mutate({ fqdn: clusterFqdn })}
                    placeholder="dxc.w6cua.org"
                    data-testid="input-cluster-fqdn"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cluster-port">Cluster Port</Label>
                  <Input
                    id="cluster-port"
                    type="number"
                    value={clusterPort}
                    onChange={(e) => setClusterPort(e.target.value)}
                    onBlur={() => updateClusterConfigMutation.mutate({ port: parseInt(clusterPort, 10) })}
                    placeholder="7300"
                    data-testid="input-cluster-port"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cluster-callsign">Login Callsign</Label>
                  <Input
                    id="cluster-callsign"
                    value={clusterCallsign}
                    onChange={(e) => setClusterCallsign(e.target.value.toUpperCase())}
                    onBlur={() => updateClusterConfigMutation.mutate({ loginCallsign: clusterCallsign })}
                    placeholder="AJ1I"
                    data-testid="input-cluster-callsign"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cheerleader-points">Points Per Spot</Label>
                  <Input
                    id="cheerleader-points"
                    type="number"
                    value={cheerleaderPoints}
                    onChange={(e) => setCheerleaderPoints(e.target.value)}
                    onBlur={() => updateClusterConfigMutation.mutate({ pointsPerSpot: parseInt(cheerleaderPoints, 10) })}
                    placeholder="100"
                    data-testid="input-points-per-spot"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of cheerleader points awarded for each qualifying spot
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Cheerleader Points System</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When a club member with valid dues spots another club member on the cluster, they earn cheerleader points. 
                    Automated spots (callsigns containing -#) are filtered out. Club Award Points = Contest Points + Cheerleader Points.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Recompute All Contests</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Recalculate scores for all contests using the current scoring method. Use this after changing the scoring method.
              </p>

              <Button
                onClick={() => recomputeAllMutation.mutate()}
                disabled={recomputeAllMutation.isPending}
                data-testid="button-recompute-all"
              >
                {recomputeAllMutation.isPending ? "Recomputing..." : "Recompute All Contests"}
              </Button>
            </Card>

            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Season Management</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Reset season totals and start a new scoring period
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">Warning: This action cannot be undone</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Current season data will be archived before reset
                  </p>
                </div>

                <Button 
                  variant="destructive" 
                  onClick={() => clearDataMutation.mutate()}
                  disabled={clearDataMutation.isPending}
                  data-testid="button-reset-season"
                >
                  {clearDataMutation.isPending ? "Clearing..." : "Clear All Contest Data"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
