import { FileUploadZone } from "@/components/FileUploadZone";
import { Radio, ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function UploadPage() {
  const [results, setResults] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const handleFileSelect = async (files: File[], email: string) => {
    setIsProcessing(true);
    setResults([]);
    
    const uploadResults: any[] = [];
    
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (email) formData.append("email", email);
        
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          uploadResults.push({
            filename: file.name,
            status: "error",
            error: data.error || "Upload failed"
          });
        } else {
          uploadResults.push({
            filename: file.name,
            ...data
          });
        }
      } catch (error: any) {
        uploadResults.push({
          filename: file.name,
          status: "error",
          error: error.message || "Upload failed"
        });
      }
    }
    
    setResults(uploadResults);
    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Club Awards Program</h1>
          </div>
          <Link href="/">
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Scoreboard
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-3">Submit Cabrillo Logs</h2>
          <p className="text-muted-foreground">
            Upload your contest log files for automated scoring and validation
          </p>
        </div>

        {isProcessing && (
          <Alert className="mb-8 border-blue-500/20 bg-blue-500/10">
            <AlertDescription>
              Processing files...
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <div className="mb-8 space-y-4">
            {results.map((result, index) => (
              <div key={index}>
                {result.status === "accepted" && (
                  <>
                    <Alert className="border-green-500/20 bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertTitle>✓ {result.filename}</AlertTitle>
                      <AlertDescription>
                        <p className="mb-2">
                          Contest: {result.contest} {result.mode} • Callsign: {result.callsign}
                        </p>
                        <p className="mb-2">
                          Claimed Score: {result.claimedScore.toLocaleString()} • Club Points: {result.normalizedPoints.toLocaleString()}
                        </p>
                        <p className="text-sm">
                          Operators scoring points: {result.memberOperators.join(", ")}
                        </p>
                      </AlertDescription>
                    </Alert>
                    
                    {result.warning && (
                      <Alert className="mt-2 border-yellow-500/20 bg-yellow-500/10">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        <AlertTitle>Operator Dues Notice</AlertTitle>
                        <AlertDescription>
                          {result.warning}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                {result.status === "error" && (
                  <Alert className="border-red-500/20 bg-red-500/10">
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertTitle>✗ {result.filename}</AlertTitle>
                    <AlertDescription>{result.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-card border border-card-border rounded-lg p-8 mb-8">
          <FileUploadZone onFileSelect={handleFileSelect} />
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Requirements</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                File format: .log or .cbr (Cabrillo format)
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                CLUB field must match your club name
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                At least one operator must be a current club member with valid dues
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                Operators without current dues will be excluded from scoring
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3">What Happens Next</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Validation</p>
                  <p>System checks club affiliation, category, and member status</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Scoring</p>
                  <p>Club points calculated based on contest/mode baseline</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Publication</p>
                  <p>Results appear on scoreboard, email confirmation sent</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
