import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ResponsiveTable } from "@/components/dashboard/DashboardLayout";
import { DataPagination } from "@/components/dashboard/DataPagination";
import { CertificateStatCard } from "@/components/certificates/CertificatePreview";
import { CertificateCanvasPreview, CertificateGenerator } from "@/components/certificates/CertificateGenerator";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useStudentScope } from "@/components/dashboard/useStudentScope";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, CheckCircle2, Download, Eye, Plus, QrCode, XCircle } from "lucide-react";
import { paginate } from "@/lib/dashboard-utils";
import { apiMutateDetailed } from "@/lib/dashboard-api";
import {
  type CertificateCanvasData,
  createCertificateCanvas,
  downloadCertificatePdf,
  downloadCertificatePng,
  formatCertificateNumber,
  toCanvasData,
} from "@/lib/certificate-canvas";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/certificates")({
  component: CertificatesPage,
});

type CertRow = {
  code: string;
  student: string;
  course: string;
  issued: string;
  status: string;
  supervisorName?: string;
  startDate?: string;
  endDate?: string;
  skills?: string;
};

function toCanvasFromRow(c: CertRow): CertificateCanvasData {
  return toCanvasData({
    recipientName: c.student,
    courseName: c.course,
    certificateNumber: c.code,
    issueDate: c.issued,
    supervisorName: c.supervisorName,
    startDate: c.startDate,
    endDate: c.endDate,
    skills: c.skills,
  });
}

function StudentCertificates({ logoUrl }: { logoUrl: string | null }) {
  const { myCertificates } = useStudentScope();
  const [page, setPage] = useState(1);
  const paged = paginate(myCertificates, page);
  const valid = myCertificates.filter((c) => c.status === "Valid").length;

  const downloadCert = async (c: (typeof myCertificates)[number]) => {
    const canvas = await createCertificateCanvas(toCanvasFromRow(c), logoUrl);
    downloadCertificatePng(canvas, `${c.code}.png`);
    toast.success("Certificate downloaded");
  };

  return (
    <>
      <PageHeader title="My Certificates" subtitle="View and download certificates issued to you." />
      <div className="grid gap-4 md:grid-cols-3">
        <CertificateStatCard label="My certificates" value={myCertificates.length} icon={Award} tone="primary" />
        <CertificateStatCard label="Valid" value={valid} icon={CheckCircle2} tone="success" />
        <CertificateStatCard label="Revoked" value={myCertificates.length - valid} icon={XCircle} tone="highlight" />
      </div>

      <div className="mt-6 grid gap-6">
        {paged.items.map((c) => (
          <Card key={c.code} className="border-border/60">
            <CardContent className="p-5">
              <CertificateCanvasPreview
                logoUrl={logoUrl}
                data={toCanvasData({
                  ...toCanvasFromRow(c),
                  institution: "ShikshaLab Institute",
                })}
                className="mb-4 max-w-2xl"
              />
              <div className="flex items-center justify-between">
                <Badge className={c.status === "Valid" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}>
                  {c.status}
                </Badge>
                <Button size="sm" disabled={c.status !== "Valid"} onClick={() => void downloadCert(c)}>
                  <Download className="mr-1 h-4 w-4" /> Download PNG
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {myCertificates.length === 0 && (
          <p className="text-sm text-muted-foreground">No certificates issued to you yet.</p>
        )}
      </div>
      <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
    </>
  );
}

function AdminCertificates({ logoUrl }: { logoUrl: string | null }) {
  const { certificates, students, courses, addCertificate } = useDashboardData();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [formData, setFormData] = useState<CertificateCanvasData>(() => toCanvasData({}));
  const paged = paginate(certificates, page);
  const valid = certificates.filter((c) => c.status === "Valid").length;

  const buildFormData = (sid: string, course: string): CertificateCanvasData => {
    const student = students.find((s) => s.id === sid);
    const courseRow = courses.find((c) => c.title === course);
    const instructor =
      courseRow?.instructor && courseRow.instructor !== "—" ? courseRow.instructor : "";
    const code = formatCertificateNumber("", 1000 + certificates.length);
    return toCanvasData({
      recipientName: student?.name || "Student Name",
      institution: "ShikshaLab Institute",
      courseName: course || "Course Name",
      certificateNumber: code,
      issueDate: new Date().toISOString().slice(0, 10),
      supervisorName: instructor || undefined,
      startDate: "2026-06-26",
      endDate: "2026-09-04",
      skills: "web development, databases, and deployment",
    });
  };

  const previewData = useMemo(
    () => buildFormData(studentId, courseTitle),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when selection / catalog changes
    [studentId, courseTitle, students, courses, certificates.length],
  );

  const openGenerator = () => {
    const sid = students[0]?.id || "";
    const course = courses[0]?.title || "";
    setStudentId(sid);
    setCourseTitle(course);
    setFormData(buildFormData(sid, course));
    setFormOpen(true);
  };

  const issue = async () => {
    const student = students.find((s) => s.id === studentId);
    const courseRow = courses.find((c) => c.title === courseTitle);
    if (!student || !courseTitle || !courseRow?._uuid) {
      toast.error("Select student and course");
      return;
    }
    const studentUuid = student._uuid;
    if (!studentUuid) {
      toast.error("Student is missing a backend id — refresh and try again");
      return;
    }
    const supervisor = formData.supervisorName.trim();
    if (!supervisor || supervisor === "Program Supervisor") {
      toast.error("Enter the program supervisor name before issuing");
      return;
    }

    setIssuing(true);
    try {
      const result = await apiMutateDetailed<{
        certificate_number?: string;
        verification_code?: string;
        issue_date?: string;
        instructor_name?: string;
      }>("/certificates/generate/", "POST", {
        student: studentUuid,
        course: courseRow._uuid,
        force: true,
        certificate_number: formData.certificateNumber.trim() || undefined,
        completion_date: formData.endDate || undefined,
        title: `Certificate of Completion — ${courseTitle}`,
        metadata: {
          instructor_name: supervisor,
          supervisor_name: supervisor,
          start_date: formData.startDate,
          end_date: formData.endDate,
          skills: formData.skills,
        },
      });

      if (!result.data) {
        toast.error(result.error || "Could not issue certificate");
        return;
      }

      const issuedCode =
        result.data.certificate_number ||
        result.data.verification_code ||
        formData.certificateNumber;
      addCertificate({
        code: issuedCode,
        student: student.name,
        course: courseTitle,
        issued:
          (result.data.issue_date || "").slice(0, 10) ||
          new Date().toISOString().slice(0, 10),
        status: "Valid",
      });
      toast.success(`Issued ${issuedCode} to ${student.name}`, {
        description: "This number can now be verified on the public verify page.",
      });
      setFormOpen(false);
      setStudentId("");
      setCourseTitle("");
    } finally {
      setIssuing(false);
    }
  };

  const downloadCert = async (c: CertRow) => {
    const canvas = await createCertificateCanvas(toCanvasFromRow(c), logoUrl);
    downloadCertificatePng(canvas, `${c.code}.png`);
    toast.success("Certificate downloaded");
  };

  return (
    <>
      <PageHeader
        title="Certificates"
        action={
          <Button size="sm" className="btn-highlight" onClick={openGenerator}>
            <Plus className="mr-1 h-4 w-4" /> Generate certificate
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CertificateStatCard label="Total issued" value={certificates.length} icon={Award} tone="primary" />
        <CertificateStatCard label="Valid" value={valid} icon={CheckCircle2} tone="success" />
        <CertificateStatCard
          label="This month"
          value={certificates.filter((c) => c.issued.startsWith(new Date().toISOString().slice(0, 7))).length}
          icon={QrCode}
          tone="info"
        />
        <CertificateStatCard label="Verifications" value={valid} icon={Eye} tone="highlight" />
      </div>

      <Card className="mb-6 border-border/60">
        <CardContent className="p-5">
          <p className="mb-4 text-sm font-semibold text-primary">Certificate template </p>
          <CertificateGenerator
            data={previewData}
            logoUrl={logoUrl}
            showForm={false}
            className="max-w-3xl"
          />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          <ResponsiveTable
            mobile={paged.items.map((c) => (
              <Card key={c.code} className="border-border/60">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold">{c.code}</p>
                    <p className="truncate text-sm">{c.student}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.course} · {c.issued}</p>
                    <Badge className={`mt-2 ${c.status === "Valid" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{c.status}</Badge>
                  </div>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => void downloadCert(c)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-mono text-xs font-semibold">{c.code}</TableCell>
                    <TableCell className="text-sm">{c.student}</TableCell>
                    <TableCell className="text-sm">{c.course}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.issued}</TableCell>
                    <TableCell>
                      <Badge className={c.status === "Valid" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void downloadCert(c)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
          <DataPagination page={paged.page} totalPages={paged.totalPages} total={paged.total} from={paged.from} to={paged.to} onPageChange={setPage} />
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate certificate</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Student</Label>
              <Select value={studentId} onValueChange={(v) => { setStudentId(v); setFormData(buildFormData(v, courseTitle)); }}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Course</Label>
              <Select value={courseTitle} onValueChange={(v) => { setCourseTitle(v); setFormData(buildFormData(studentId, v)); }}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.slug} value={c.title}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CertificateGenerator data={formData} logoUrl={logoUrl} showForm onChange={setFormData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-1 h-4 w-4" /> Full preview
            </Button>
            <Button className="btn-highlight" disabled={issuing} onClick={() => void issue()}>
              {issuing ? "Issuing…" : "Generate & issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Certificate preview</DialogTitle></DialogHeader>
          <CertificateCanvasPreview logoUrl={logoUrl} data={formData} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button
              onClick={() =>
                void createCertificateCanvas(formData, logoUrl).then((canvas) => {
                  downloadCertificatePdf(canvas, `${formData.certificateNumber}.pdf`);
                  toast.success("PDF downloaded");
                })
              }
            >
              <Download className="mr-1 h-4 w-4" /> Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CertificatesPage() {
  const { isStudent } = useAuth();
  const logoUrl = null;
  if (isStudent) return <StudentCertificates logoUrl={logoUrl} />;
  return <AdminCertificates logoUrl={logoUrl} />;
}
