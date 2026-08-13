import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileUp, FileText } from "lucide-react";
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

  const handleImport = async (file: File) => {
    try {
      const rows = await parseCsvFile(file);
      if (onImport) onImport(rows);
      else toast.success(`Imported ${Math.max(0, rows.length - 1)} ${entity} row(s)`);
    } catch {
      toast.error("Failed to read CSV file");
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
          onClick={() => {
            void exportPdf(
              `${entity} report`,
              exportHeaders ?? csvHeaders,
              exportRows.length ? exportRows : csvSampleRows,
              { subtitle: `ShikshaLab ${entity} export — ${(exportRows.length ? exportRows : csvSampleRows).length} record(s)` },
            ).then(() => toast.success("PDF exported"));
          }}
        >
          <FileText className="mr-1 h-4 w-4" /> Export PDF
        </Button>
      )}
    </div>
  );
}
