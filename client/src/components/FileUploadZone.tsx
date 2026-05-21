import { useState, useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileUploadZoneProps {
  onFileSelect?: (files: File[], email: string) => void;
}

export function FileUploadZone({ onFileSelect }: FileUploadZoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [email, setEmail] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set isDragging to false if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.name.endsWith('.log') || file.name.endsWith('.cbr')
    );
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...Array.from(selectedFiles)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (files.length > 0 && onFileSelect) {
      onFileSelect(files, email);
      console.log('Submitting files:', files.map(f => f.name).join(', '), 'Email:', email);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
        `}
      >
        <div>
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Drop your Cabrillo logs here</p>
          <p className="text-sm text-muted-foreground mb-4">
            Supports .log and .cbr files • Multiple files supported
          </p>
          <Input
            type="file"
            accept=".log,.cbr"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            data-testid="input-file"
          />
          <Button asChild variant="outline">
            <label htmlFor="file-upload" className="cursor-pointer">
              Choose Files
            </label>
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <Label>Selected Files ({files.length})</Label>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                data-testid={`file-item-${index}`}
              >
                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid={`text-filename-${index}`}>{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  data-testid={`button-remove-file-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="input-email"
        />
        <p className="text-xs text-muted-foreground">
          Receive confirmation and results notification
        </p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={files.length === 0}
        className="w-full"
        data-testid="button-submit-log"
      >
        Submit {files.length > 0 ? `${files.length} Log${files.length > 1 ? 's' : ''}` : 'Logs'}
      </Button>
    </div>
  );
}
