import { useState } from "react";
import { Download, Loader2, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react";
import { api } from "../../api/client.js";
import type { ParsedFile } from "../../lib/fileParser.js";

interface FileDownloadButtonProps {
  file: ParsedFile;
}

type DownloadState = "idle" | "uploading" | "ready" | "error";

export function FileDownloadButton({ file }: FileDownloadButtonProps) {
  const [state, setState] = useState<DownloadState>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (state === "ready" && downloadUrl) {
      // Already processed, trigger download
      window.open(downloadUrl, "_blank");
      return;
    }

    if (state === "uploading") {
      return;
    }

    setState("uploading");
    setError(null);

    try {
      let result;

      if (file.contentType === "csv") {
        // Convert CSV to Excel and get download URL
        result = await api.createExcelFromCsv(file.filename, file.content);
      } else {
        // Upload base64 content directly
        result = await api.createGeneratedFile(file.filename, file.content);
      }

      setDownloadUrl(result.downloadUrl);
      setState("ready");

      // Automatically trigger download
      window.open(result.downloadUrl, "_blank");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to prepare file";
      setError(message);
      setState("error");
    }
  };

  const getIcon = () => {
    switch (state) {
      case "uploading":
        return <Loader2 size={16} className="spinning" />;
      case "ready":
        return <CheckCircle size={16} />;
      case "error":
        return <XCircle size={16} />;
      default:
        return <Download size={16} />;
    }
  };

  const getLabel = () => {
    switch (state) {
      case "uploading":
        return "Preparing...";
      case "ready":
        return "Download again";
      case "error":
        return "Retry";
      default:
        return "Download";
    }
  };

  return (
    <div className="file-download-container">
      <button
        type="button"
        className={`file-download-button ${state}`}
        onClick={handleDownload}
        disabled={state === "uploading"}
        title={error || `Download ${file.filename}`}
      >
        {getIcon()}
        <span className="file-download-name">{file.filename}</span>
        <span className="file-download-action">{getLabel()}</span>
      </button>
      {error && <span className="file-download-error">{error}</span>}
    </div>
  );
}
