import { useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/api";
import {
  fetchInvoices,
  fetchStudentFees,
  type ApiInvoiceRow,
  type ApiStudentFeeRow,
} from "@/lib/dashboard-api";
import { onAuthChanged } from "@/lib/auth-events";

export type StudentFeeRow = {
  id: string;
  course: string;
  batch: string;
  total: number;
  paid: number;
  due: number;
  status: "Paid" | "Pending" | "Partially overdue";
  apiStatus: string;
  dueDate?: string | null;
};

function mapDisplayStatus(
  apiStatus: string | undefined,
  paid: number,
  due: number,
): StudentFeeRow["status"] {
  const normalized = (apiStatus || "").toUpperCase();
  if (normalized === "PAID" || due <= 0) return "Paid";
  if (normalized === "PENDING" || paid <= 0) return "Pending";
  return "Partially overdue";
}

function mapFeeRow(f: ApiStudentFeeRow): StudentFeeRow {
  const total = Number(f.total_amount ?? 0);
  const paid = Number(f.paid_amount ?? 0);
  const due = Number(f.due_amount ?? Math.max(0, total - paid));
  return {
    id: String(f.id),
    course: f.course_name || "Course",
    batch: f.batch_code || "—",
    total,
    paid,
    due,
    apiStatus: f.status || "PENDING",
    status: mapDisplayStatus(f.status, paid, due),
    dueDate: f.due_date,
  };
}

export function useStudentFees() {
  const [fees, setFees] = useState<StudentFeeRow[]>([]);
  const [invoices, setInvoices] = useState<ApiInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      setFees([]);
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [feeRows, invoiceRows] = await Promise.all([
        fetchStudentFees(),
        fetchInvoices(),
      ]);
      if (feeRows.length > 0) {
        setFees(feeRows.map(mapFeeRow));
        setInvoices(invoiceRows);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return onAuthChanged(() => {
      void load();
    });
  }, [load]);

  const totals = useMemo(() => {
    const total = fees.reduce((n, f) => n + f.total, 0);
    const paid = fees.reduce((n, f) => n + f.paid, 0);
    const due = fees.reduce((n, f) => n + f.due, 0);
    return { total, paid, due };
  }, [fees]);

  return {
    fees,
    invoices,
    totals,
    loading,
    refresh: load,
  };
}
