import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, StatCard, ResponsiveTable } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useStudentScope } from "@/components/dashboard/useStudentScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, TrendingUp, AlertCircle, Receipt, CheckCircle2, Loader2, Search, History, FileText, Calendar } from "lucide-react";
import { inr } from "@/lib/mock";
import { exportPdf, paginate } from "@/lib/dashboard-utils";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FeeTotalsFooter } from "@/components/dashboard/FeeTotalsFooter";
import { DashboardSectionLinks } from "@/components/dashboard/DashboardSectionLinks";
import { PersonAvatar } from "@/components/dashboard/PersonAvatar";
import { useAdminAnalytics } from "@/components/dashboard/useAdminAnalytics";
import { useStudentFees } from "@/components/dashboard/useStudentFees";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { fetchInvoices, recordStudentFeePayment, apiList, type ApiInvoiceRow, type ApiPaymentRow } from "@/lib/dashboard-api";
import { getAccessToken } from "@/lib/api";
import { syncAfter } from "@/lib/dashboard-sync";

export const Route = createFileRoute("/dashboard/fees")({
  component: FeesPage,
});

type FeeStatus = "Paid" | "Pending" | "Partially overdue";

function feeStatus(paid: number, due: number, total: number): FeeStatus {
  if (due <= 0) return "Paid";
  if (paid <= 0) return "Pending";
  if (paid > 0 && due > 0) return "Partially overdue";
  return total > 0 ? "Pending" : "Paid";
}

function statusBadge(status: FeeStatus) {
  if (status === "Paid") return "bg-success/15 text-success hover:bg-success/20";
  if (status === "Pending") return "bg-warning/15 text-[color:var(--highlight-foreground)] hover:bg-warning/20";
  return "bg-destructive/15 text-destructive hover:bg-destructive/20";
}


function StudentFees() {
  const { fees: apiFees, invoices, totals, loading } = useStudentFees();
  const feeRows = apiFees;

  if (loading) {
    return (
      <>
        <PageHeader title="My Fees" subtitle="Loading your fee records…" />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading fees…
        </div>
      </>
    );
  }

  if (feeRows.length === 0) {
    return (
      <>
        <PageHeader title="My Fees" subtitle="Your course fee status." />
        <p className="text-sm text-muted-foreground">No fee records found for your account.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="My Fees"
        subtitle="Live fee data from your account. Contact the institute if you have questions about your fees."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Course fee" value={inr(totals.total)} icon={Banknote} tone="primary" />
        <StatCard label="Paid" value={inr(totals.paid)} icon={CheckCircle2} tone="success" />
        <StatCard label="Overdue" value={inr(totals.due)} icon={AlertCircle} tone="highlight" />
      </div>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle>Fee by course</CardTitle>
          <p className="text-xs text-muted-foreground">Status: Pending · Partially overdue · Paid</p>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <ResponsiveTable
            mobile={feeRows.map((row) => (
              <Card key={row.id} className="border-border/60">
                <CardContent className="space-y-2 p-4">
                  <p className="font-semibold">{row.course}</p>
                  <p className="text-xs text-muted-foreground">Batch: {row.batch}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p><span className="text-muted-foreground">Total:</span> {inr(row.total)}</p>
                    <p><span className="text-muted-foreground">Paid:</span> {inr(row.paid)}</p>
                    <p><span className="text-muted-foreground">Overdue:</span> {row.due > 0 ? inr(row.due) : "—"}</p>
                    <Badge className={statusBadge(row.status)}>{row.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm font-medium">{row.course}</TableCell>
                  <TableCell className="text-sm">{row.batch}</TableCell>
                  <TableCell className="text-sm">{inr(row.total)}</TableCell>
                  <TableCell className="text-sm">{inr(row.paid)}</TableCell>
                  <TableCell className="text-sm font-semibold text-destructive">
                    {row.due > 0 ? inr(row.due) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusBadge(row.status)}>{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>

      {invoices.length > 0 && (
        <Card className="mt-6 border-border/60">
          <CardHeader>
            <CardTitle>My invoices</CardTitle>
            <p className="text-xs text-muted-foreground">Issued invoices for your courses</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-4 sm:p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={String(inv.id)}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number || String(inv.id).slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{inv.course_name || "—"}</TableCell>
                    <TableCell className="text-sm">{inr(Number(inv.total_amount ?? inv.amount ?? 0))}</TableCell>
                    <TableCell className="text-sm">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inv.status || "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DashboardSectionLinks role="student" section="/dashboard/fees" className="mt-6" />
    </>
  );
}

function AdminFees() {
  const { students, updateStudent, refreshData } = useDashboardData();
  const { revenueSeries: revData, revenueSummary } = useAdminAnalytics();
  const [page, setPage] = useState(1);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<ApiInvoiceRow | null>(null);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [invoices, setInvoices] = useState<ApiInvoiceRow[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<ApiPaymentRow | null>(null);
  const [receiptStudentName, setReceiptStudentName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPayments, setHistoryPayments] = useState<ApiPaymentRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStudentName, setHistoryStudentName] = useState("");
  const receiptRef = useRef<HTMLDivElement>(null);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    const rows = await fetchInvoices();
    setInvoices(rows);
    setInvoicesLoading(false);
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const onStudentChange = (id: string) => {
    setStudentId(id);
    const student = students.find((s) => s.id === id);
    if (student && student.fees.due > 0) {
      setAmount(String(student.fees.due));
    } else {
      setAmount("");
    }
  };

  const openRecordPayment = (id: string) => {
    onStudentChange(id);
    setPaymentMethod("CASH");
    setPaymentNotes("");
    setPaymentOpen(true);
  };

  const feeRows = useMemo(
    () =>
      students.map((s) => ({
        ...s,
        feeStatus: feeStatus(s.fees.paid, s.fees.due, s.fees.total),
        fullyPaid: s.fees.due === 0,
      })),
    [students],
  );

  const filteredRows = useMemo(() => {
    let rows = feeRows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      const map: Record<string, FeeStatus[]> = {
        paid: ["Paid"],
        pending: ["Pending"],
        partial: ["Partially overdue"],
        overdue: ["Partially overdue", "Pending"],
      };
      const allowed = map[statusFilter] ?? [];
      rows = rows.filter((s) => {
        if (statusFilter === "overdue") return s.fees.due > 0 && s.feeStatus !== "Paid";
        return allowed.includes(s.feeStatus);
      });
    }
    return rows;
  }, [feeRows, searchQuery, statusFilter]);

  const totalCollected = feeRows.reduce((n, s) => n + s.fees.paid, 0);
  const totalDue = feeRows.reduce((n, s) => n + s.fees.due, 0);
  const totalAmount = feeRows.reduce((n, s) => n + s.fees.total, 0);
  const thisMonthRevenue = revenueSummary?.this_month ? Number(revenueSummary.this_month) : (revData.length ? revData[revData.length - 1].revenue : 0);
  const todayRevenue = revenueSummary?.today ? Number(revenueSummary.today) : 0;
  const thisWeekRevenue = revenueSummary?.this_week ? Number(revenueSummary.this_week) : 0;
  const outstanding = revenueSummary?.outstanding ? Number(revenueSummary.outstanding) : totalDue;
  const paged = paginate(filteredRows, page);

  const openPaymentHistory = async (studentFeeId: string, studentName: string) => {
    setHistoryStudentName(studentName);
    setHistoryPayments([]);
    setHistoryLoading(true);
    setHistoryOpen(true);
    const payments = await apiList<ApiPaymentRow>(`/fees/payments/?student_fee=${studentFeeId}`);
    setHistoryPayments(payments);
    setHistoryLoading(false);
  };

  const openReceipt = (payment: ApiPaymentRow, studentName: string) => {
    setReceiptPayment(payment);
    setReceiptStudentName(studentName);
    setReceiptOpen(true);
  };

  const printReceipt = () => {
    const content = receiptRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Receipt</title><style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:500px;margin:auto}h2{margin-bottom:1rem}p{margin:0.3rem 0}hr{margin:1rem 0}.label{color:#666;min-width:140px;display:inline-block}</style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const generateInvoice = async () => {
    const student = students.find((s) => s.id === studentId);
    const amt = Number(amount);
    if (!student || !amt || amt <= 0) {
      toast.error("Select a student and enter a valid amount");
      return;
    }
    const feeId = (student as { _studentFeeId?: string })._studentFeeId;
    if (feeId) {
      syncAfter({ type: "createInvoice", studentFeeId: feeId, amount: amt }, async () => {
        await refreshData();
        await loadInvoices();
      });
    }
    toast.success(`Invoice of ${inr(amt)} generated for ${student.name}`);
    setInvoiceOpen(false);
    setStudentId("");
    setAmount("");
    void loadInvoices();
  };

  const recordPayment = async () => {
    const student = students.find((s) => s.id === studentId);
    const amt = Number(amount);
    const feeId = (student as { _studentFeeId?: string } | undefined)?._studentFeeId;
    if (!student || !feeId) {
      toast.error("Select a student with a fee record");
      return;
    }
    if (!amt || amt <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (amt > student.fees.due) {
      toast.error(`Amount cannot exceed remaining balance (${inr(student.fees.due)})`);
      return;
    }
    setPaymentBusy(true);
    const payment = await recordStudentFeePayment(feeId, {
      amount: amt,
      payment_method: paymentMethod,
      notes: paymentNotes,
      create_receipt: true,
    });
    setPaymentBusy(false);
    if (!payment) {
      toast.error("Could not record payment");
      return;
    }
    const paid = Math.min(student.fees.total, student.fees.paid + amt);
    updateStudent(student.id, {
      fees: { total: student.fees.total, paid, due: Math.max(0, student.fees.total - paid) },
    });
    await refreshData();
    toast.success(
      `Payment of ${inr(amt)} recorded` +
        (payment.receipt_number ? ` · Receipt ${payment.receipt_number}` : ""),
    );
    setPaymentOpen(false);
    if (payment.receipt_number) {
      openReceipt({ ...payment, course_name: student.course }, student.name);
    }
    setStudentId("");
    setAmount("");
    setPaymentNotes("");
  };

  return (
    <>
      <PageHeader
        title="Fees"
        subtitle="Track collections, dues and invoices."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStudentId("");
                setAmount("");
                setPaymentMethod("CASH");
                setPaymentOpen(true);
              }}
            >
              <Banknote className="mr-1 h-4 w-4" /> Record payment
            </Button>
            <Button size="sm" className="btn-highlight" onClick={() => setInvoiceOpen(true)}>
              <Receipt className="mr-1 h-4 w-4" /> Generate invoice
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Today's revenue" value={inr(todayRevenue)} icon={Calendar} tone="success" />
        <StatCard label="This week" value={inr(thisWeekRevenue)} icon={TrendingUp} tone="primary" />
        <StatCard label="This month" value={inr(thisMonthRevenue)} icon={Banknote} tone="info" />
        <StatCard label="Outstanding" value={inr(outstanding)} icon={AlertCircle} tone="highlight" />
      </div>

      <Card className="mt-6 border-border/60">
        <CardHeader><CardTitle>Revenue trend</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revData}>
              <defs><linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#244777" stopOpacity={0.4} /><stop offset="100%" stopColor="#244777" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#244777" strokeWidth={2.5} fill="url(#rev2)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {(revenueSummary?.by_course?.length || revenueSummary?.by_batch?.length) ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {revenueSummary.by_course && revenueSummary.by_course.length > 0 && (
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">Revenue by Course</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-4">
                <Table>
                  <TableHeader><TableRow><TableHead>Course</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {revenueSummary.by_course.map((c) => (
                      <TableRow key={c.course_name}>
                        <TableCell className="text-sm">{c.course_name}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{inr(Number(c.total))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {revenueSummary.by_batch && revenueSummary.by_batch.length > 0 && (
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">Revenue by Batch</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-4">
                <Table>
                  <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {revenueSummary.by_batch.map((b) => (
                      <TableRow key={b.batch_code}>
                        <TableCell className="text-sm font-mono">{b.batch_code}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{inr(Number(b.total))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      <Card className="mt-6 border-border/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Fee records</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() =>
              void exportPdf(
                "Fees report",
                ["Student", "Course", "Total", "Paid", "Due", "Status"],
                feeRows.map((s) => [s.name, s.course, inr(s.fees.total), inr(s.fees.paid), inr(s.fees.due), s.feeStatus]),
                { subtitle: `ShikshaLab fees summary — ${feeRows.length} student(s)` },
              )
            }
          >
            Export PDF
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="partial">Partially Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ResponsiveTable
            mobile={paged.items.map((s) => (
              <Card key={s.id} className="border-border/60">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <PersonAvatar src={s.avatar} name={s.name} className="h-9 w-9" />
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.course}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p>Total: {inr(s.fees.total)}</p>
                    <p>Paid: {inr(s.fees.paid)}</p>
                    <p>Due: {s.fees.due > 0 ? inr(s.fees.due) : "—"}</p>
                    <Badge className={statusBadge(s.feeStatus)}>{s.feeStatus}</Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!s.fullyPaid && (
                      <Button size="sm" className="w-full" onClick={() => openRecordPayment(s.id)}>
                        Record payment
                      </Button>
                    )}
                    {(s as { _studentFeeId?: string })._studentFeeId && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => openPaymentHistory((s as { _studentFeeId?: string })._studentFeeId!, s.name)}>
                        <History className="mr-1 h-3.5 w-3.5" /> Payment history
                      </Button>
                    )}
                    {!s.fullyPaid && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => toast.success(`Reminder sent to ${s.name}`)}>
                        Send reminder
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          >
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Course</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><div className="flex items-center gap-2"><PersonAvatar src={s.avatar} name={s.name} className="h-8 w-8" /><div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.id}</p></div></div></TableCell>
                  <TableCell className="text-sm">{s.course}</TableCell>
                  <TableCell className="text-sm">{inr(s.fees.total)}</TableCell>
                  <TableCell className="text-sm">{inr(s.fees.paid)}</TableCell>
                  <TableCell className="text-sm">{s.fees.due > 0 ? inr(s.fees.due) : "—"}</TableCell>
                  <TableCell>
                    <Badge className={statusBadge(s.feeStatus)}>{s.feeStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {!s.fullyPaid && (
                        <Button size="sm" onClick={() => openRecordPayment(s.id)}>
                          Record payment
                        </Button>
                      )}
                      {(s as { _studentFeeId?: string })._studentFeeId && (
                        <Button size="sm" variant="outline" onClick={() => openPaymentHistory((s as { _studentFeeId?: string })._studentFeeId!, s.name)}>
                          <History className="mr-1 h-3.5 w-3.5" /> History
                        </Button>
                      )}
                      {!s.fullyPaid && (
                        <Button size="sm" variant="outline" onClick={() => toast.success(`Reminder sent to ${s.name}`)}>
                          Send reminder
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </ResponsiveTable>
          <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
          <FeeTotalsFooter totalAmount={totalAmount} totalPaid={totalCollected} totalOverdue={totalDue} />
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Generated invoices</CardTitle>
            <p className="text-xs text-muted-foreground">View and download issued invoices</p>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => void loadInvoices()} disabled={invoicesLoading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <p className="text-sm text-muted-foreground">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet. Generate one using the button above.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{inv.student_name || inv.student_id_display || "—"}</TableCell>
                    <TableCell className="text-sm">{inv.course_name || "—"}</TableCell>
                    <TableCell className="text-sm">{inr(Number(inv.total_amount || inv.amount))}</TableCell>
                    <TableCell className="text-sm">{inv.due_date}</TableCell>
                    <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setViewInvoice(inv)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DashboardSectionLinks role="admin" section="/dashboard/fees" className="mt-6" />

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Record offline payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Student</Label>
              <Select value={studentId} onValueChange={onStudentChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students
                    .filter((s) => s.fees.due > 0)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — due {inr(s.fees.due)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount received (Rs)</Label>
              <Input
                className="mt-1.5"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Payment method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                className="mt-1.5"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Reference / cheque no."
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void recordPayment()} disabled={paymentBusy}>
              {paymentBusy ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader><DialogTitle>Generate invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Student</Label>
              <Select value={studentId} onValueChange={onStudentChange}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.filter((s) => s.fees.due > 0).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — due {inr(s.fees.due)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (Rs)</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={studentId ? "Due amount autofilled" : "6000"}
              />
              {studentId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Prefilled with outstanding due amount. Adjust if needed.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
            <Button onClick={() => void generateInvoice()}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          {viewInvoice && (
            <>
              <DialogHeader><DialogTitle>Invoice {viewInvoice.invoice_number}</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Student:</span> {viewInvoice.student_name}</p>
                <p><span className="text-muted-foreground">Course:</span> {viewInvoice.course_name || "—"}</p>
                <p><span className="text-muted-foreground">Amount:</span> {inr(Number(viewInvoice.total_amount || viewInvoice.amount))}</p>
                <p><span className="text-muted-foreground">Issue date:</span> {viewInvoice.issue_date}</p>
                <p><span className="text-muted-foreground">Due date:</span> {viewInvoice.due_date}</p>
                <p><span className="text-muted-foreground">Status:</span> {viewInvoice.status}</p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    void exportPdf(
                      `Invoice ${viewInvoice.invoice_number}`,
                      ["Field", "Value"],
                      [
                        ["Invoice #", viewInvoice.invoice_number],
                        ["Student", viewInvoice.student_name || ""],
                        ["Course", viewInvoice.course_name || ""],
                        ["Amount", inr(Number(viewInvoice.total_amount || viewInvoice.amount))],
                        ["Due", viewInvoice.due_date],
                        ["Status", viewInvoice.status],
                      ],
                    )
                  }
                >
                  Download PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          {receiptPayment && (
            <>
              <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
              <div ref={receiptRef} className="space-y-2 text-sm">
                <h2 className="text-lg font-semibold">ShikshaLab — Payment Receipt</h2>
                <hr />
                <p><span className="text-muted-foreground">Receipt Number:</span> {receiptPayment.receipt_number || "—"}</p>
                <p><span className="text-muted-foreground">Student Name:</span> {receiptStudentName}</p>
                <p><span className="text-muted-foreground">Course:</span> {receiptPayment.course_name || "—"}</p>
                <p><span className="text-muted-foreground">Amount Paid:</span> {inr(Number(receiptPayment.amount))}</p>
                <p><span className="text-muted-foreground">Payment Method:</span> {receiptPayment.payment_method || "—"}</p>
                <p><span className="text-muted-foreground">Payment Date:</span> {receiptPayment.paid_at ? new Date(receiptPayment.paid_at).toLocaleDateString() : "—"}</p>
                {receiptPayment.notes && <p><span className="text-muted-foreground">Notes:</span> {receiptPayment.notes}</p>}
                <hr />
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setReceiptOpen(false)}>Close</Button>
                <Button onClick={printReceipt}>
                  <FileText className="mr-1 h-4 w-4" /> Print Receipt
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment History — {historyStudentName}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading payments…
            </div>
          ) : historyPayments.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-mono">{p.payment_number || p.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">{inr(Number(p.amount))}</TableCell>
                      <TableCell className="text-sm">{p.payment_method || "—"}</TableCell>
                      <TableCell className="text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{p.receipt_number || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{p.status || "—"}</Badge></TableCell>
                      <TableCell>
                        {p.receipt_number && (
                          <Button size="sm" variant="outline" onClick={() => { openReceipt(p, historyStudentName); setHistoryOpen(false); }}>
                            <Receipt className="mr-1 h-3.5 w-3.5" /> Receipt
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FeesPage() {
  const { isTeacher, isStudent } = useAuth();
  if (isTeacher) return <Navigate to="/dashboard" />;
  if (isStudent) return <StudentFees />;
  return <AdminFees />;
}
