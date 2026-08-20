import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileUp, FileText, Loader2 } from "lucide-react";
import { downloadCsv, exportPdf, parseCsvFile } from "@/lib/dashboard-utils";
import { toast } from "sonner";

type Props = {
  entity: string;
  csvHeaders: string[];
  csvSampleRows?: (string | number)[][];
  exportHeaders?: string[];
  exportRows?: (string | number)[][];
  showImport?: boolean;
  showExport?: boolean;
  downloadLabel?: string;
  onImport?: (rows: string[][]) => void;
};

export function BulkActions({
  entity,
  csvHeaders,
  csvSampleRows = [],
  exportHeaders,
  exportRows = [],
  showImport = true,
  showExport = false,
  downloadLabel = "Download template",
  onImport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleImport = async (file: File) => {
    try {
      const rows = await parseCsvFile(file);
      if (onImport) onImport(rows);
      else toast.success(`Imported ${Math.max(0, rows.length - 1)} ${entity} row(s)`);
    } catch {
      toast.error("Failed to read CSV file");
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = exportRows.length ? exportRows : csvSampleRows;
      const result = await exportPdf(
        `${entity} report`,
        exportHeaders ?? csvHeaders,
        rows,
      );
      if (result.ok) {
        toast.success(rows.length ? "PDF exported" : "PDF exported (no records)");
      } else {
        toast.error(result.error || "Could not export PDF");
      }
    } catch {
      toast.error("Could not export PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {showImport && (
        <>
          <input
            ref={inputRef}
            id="bulk-import-csv"
            name="bulk_import_csv"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-1 h-4 w-4" /> Bulk import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(`${entity}-template.csv`, csvHeaders, csvSampleRows)}
          >
            <Download className="mr-1 h-4 w-4" /> {downloadLabel}
          </Button>
        </>
      )}
      {showExport && (
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-1 h-4 w-4" />
          )}
          {exporting ? "Exporting…" : "Export PDF"}
        </Button>
      )}
    </div>
  );
}
