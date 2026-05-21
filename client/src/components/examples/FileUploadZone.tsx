import { FileUploadZone } from "../FileUploadZone";

export default function FileUploadZoneExample() {
  return (
    <div className="p-8 bg-background max-w-2xl mx-auto">
      <FileUploadZone
        onFileSelect={(file, email) => {
          console.log("File selected:", file.name, "Email:", email);
        }}
      />
    </div>
  );
}
