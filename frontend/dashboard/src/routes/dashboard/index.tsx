import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/dashboard/DashboardLayout";
import { useDashboardData } from "@/components/dashboard/DashboardDataContext";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useTeacherScope } from "@/components/dashboard/useTeacherScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, GraduationCap, BookOpen, Banknote, ArrowUpRight, TrendingUp, ClipboardList, Clock, Award, Kanban } from "lucide-react";
import { inr } from "@/lib/mock";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { useStudentScope } from "@/components/dashboard/useStudentScope";
import { useDashboardOverview } from "@/components/dashboard/useDashboardOverview";
import { useAdminAnalytics } from "@/components/dashboard/useAdminAnalytics";
import { DashboardSectionLinks } from "@/components/dashboard/DashboardSectionLinks";
import { StudentCourseReview } from "@/components/dashboard/StudentCourseReview";
import { PersonAvatar } from "@/components/dashboard/PersonAvatar";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

const shiftTone: Record<string, string> = {
  Morning: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  Daytime: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  Evening: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  Weekend: "bg-violet-100 text-violet-800 hover:bg-violet-100",
};

function TeacherOverview() {
  const { user } = useAuth();
  const { myCourses, myBatches, myStudents, myAssignments } = useTeacherScope();
  const { overview } = useDashboardOverview();
  const ongoing = myBatches.filter((b) => b.status === "Ongoing");
  const pendingReview = myAssignments.filter((a) => a.status === "Grading" || a.status === "Active");
  const avgProgress = myStudents.length
    ? Math.round(myStudents.reduce((n, s) => n + s.progress, 0) / myStudents.length)
    : 0;

  const coursesCount = overview.my_courses ?? myCourses.length;
  const batchesCount = overview.my_batches ?? myBatches.length;
  const studentsCount = overview.my_students ?? myStudents.length;
  const pendingCount = overview.pending_reviews ?? pendingReview.length;
  const ongoingCount = overview.ongoing_batches ?? ongoing.length;
  const progressAvg = overview.avg_progress ?? avgProgress;
  const openPortals = overview.open_portals ?? myAssignments.filter((a) => a.portalOpen).length;
  const activeLearners = overview.active_learners ?? myStudents.filter((s) => s.status === "Active").length;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle={`Your teaching overview — courses, batches, and pending reviews.${overview.source === "api" ? " (live)" : ""}`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My courses" value={coursesCount} icon={BookOpen} tone="primary" href="/dashboard/courses" />
        <StatCard label="My batches" value={batchesCount} delta={`${ongoingCount} ongoing`} icon={GraduationCap} tone="info" href="/dashboard/batches" />
        <StatCard label="My students" value={studentsCount} icon={Users} tone="success" href="/dashboard/students" />
        <StatCard label="Pending reviews" value={pendingCount} icon={ClipboardList} tone="highlight" href="/dashboard/assignments" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>My batches</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/batches">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {myBatches.length === 0 && <p className="text-sm text-muted-foreground">No batches assigned yet.</p>}
            {myBatches.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-semibold">{b.course}</p>
                  <p className="text-xs text-muted-foreground">{b.id} · Starts {b.start}</p>
                </div>
                <Badge className={b.status === "Ongoing" ? "bg-success/15 text-success" : "bg-info/15 text-info"}>{b.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Assignments to review</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/assignments">Open <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Subs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myAssignments.slice(0, 5).map((a) => (
                  <TableRow key={a.title}>
                    <TableCell className="text-sm font-medium">{a.title}</TableCell>
                    <TableCell className="text-sm">{a.due}</TableCell>
                    <TableCell className="text-sm">{a.submissions}/{a.total}</TableCell>
                  </TableRow>
                ))}
                {myAssignments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">No assignments yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Avg student progress" value={`${progressAvg}%`} icon={TrendingUp} tone="success" />
        <StatCard label="Open portals" value={openPortals} icon={Clock} tone="info" />
        <StatCard label="Active learners" value={activeLearners} icon={Users} tone="primary" />
      </div>

      <div className="mt-6">
        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Students in my batches</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/students">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myStudents.slice(0, 6).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PersonAvatar src={s.avatar} name={s.name} className="h-8 w-8" />
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.batch}</TableCell>
                    <TableCell className="text-sm">{s.progress}%</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "Active" ? "default" : "secondary"} className={s.status === "Active" ? "bg-success/15 text-success hover:bg-success/20" : ""}>
                        {s.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {myStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">No students in your batches.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <DashboardSectionLinks role={user.role} section="/dashboard" className="mt-6" />
    </>
  );
}

function AdminOverview() {
  const { user } = useAuth();
  const { students, batches, courses, dataSource } = useDashboardData();
  const { overview } = useDashboardOverview();
  const { revenueSeries: revData, enrollmentsSeries: enrData, live: chartsLive } = useAdminAnalytics();
  const ongoing = batches.filter((b) => b.status === "Ongoing");
  const revenue = overview.revenue_this_month
    ? Number(overview.revenue_this_month)
    : students.reduce((n, s) => n + s.fees.paid, 0);
  const studentsCount = overview.students ?? students.length;
  const batchesCount = overview.active_batches ?? ongoing.length;
  const coursesCount = overview.courses ?? courses.length;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle={`Here's what's happening at ShikshaLab today.${dataSource === "api" || overview.source === "api" ? " (live data)" : ""}`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total students" value={studentsCount} icon={Users} tone="primary" href="/dashboard/students" />
        <StatCard label="Active batches" value={batchesCount} delta={`${ongoing.length} ongoing`} icon={GraduationCap} tone="info" href="/dashboard/batches" />
        <StatCard label="Courses" value={coursesCount} icon={BookOpen} tone="success" href="/dashboard/courses" />
        <StatCard label="Revenue (Jul)" value={inr(revenue || 0)} icon={Banknote} tone="highlight" href="/dashboard/fees" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div><CardTitle>Revenue trend</CardTitle><p className="text-xs text-muted-foreground">Last 6 months{chartsLive ? " · live" : ""}</p></div>
            <Badge variant="secondary"><TrendingUp className="mr-1 h-3 w-3" /> +18%</Badge>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#244777" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#244777" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Area type="monotone" dataKey="revenue" stroke="#244777" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle>Enrollments</CardTitle><p className="text-xs text-muted-foreground">New students / month</p></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="students" fill="#f59e0d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Recent students</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/students">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Course</TableHead><TableHead>Batch</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {students.slice(0, 5).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><div className="flex items-center gap-2"><PersonAvatar src={s.avatar} name={s.name} className="h-8 w-8" /><div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.id}</p></div></div></TableCell>
                    <TableCell className="text-sm">{s.course}</TableCell>
                    <TableCell className="text-sm">{s.batch}</TableCell>
                    <TableCell><Badge variant={s.status === "Active" ? "default" : "secondary"} className={s.status === "Active" ? "bg-success/15 text-success hover:bg-success/20" : ""}>{s.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="border-border/60">
          <CardHeader><CardTitle>Ongoing batches</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ongoing.map((b) => (
                <div key={b.id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{b.id}</Badge>
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${shiftTone[b.shift] ?? "bg-muted text-muted-foreground"}`}>
                      {b.shift}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{b.course}</p>
                  <p className="text-xs text-muted-foreground">{b.teacher}</p>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(b.enrolled / b.capacity) * 100}%` }} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">{b.enrolled}/{b.capacity} enrolled</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <DashboardSectionLinks role={user.role} section="/dashboard" className="mt-6" />
    </>
  );
}

function StudentOverview() {
  const { user } = useAuth();
  const { me, myCourses, myAssignments, myTasks, myCertificates, openAssignments, paid } = useStudentScope();
  const { overview } = useDashboardOverview();
  const todo = myTasks.filter((t) => t.status === "To Do").length;
  const inProgress = myTasks.filter((t) => t.status === "In Progress").length;

  const coursesCount = overview.my_courses ?? myCourses.length;
  const openCount = overview.open_assignments ?? openAssignments.length;
  const tasksCount = overview.active_tasks ?? todo + inProgress;
  const certCount = overview.certificates ?? myCertificates.length;
  const progressVal = overview.progress ?? me?.progress ?? 0;
  const courseTitle = overview.course_title || me?.course || "Your course";
  const courseCompleted =
    progressVal >= 100 || me?.status === "Completed" || certCount > 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle={`Your learning overview — courses, tasks, and open assignments.${overview.source === "api" ? " (live)" : ""}`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My courses" value={coursesCount} icon={BookOpen} tone="primary" href="/dashboard/courses" />
        <StatCard label="Open assignments" value={openCount} icon={ClipboardList} tone="highlight" href="/dashboard/assignments" />
        <StatCard label="Active tasks" value={tasksCount} icon={Kanban} tone="info" href="/dashboard/tasks" />
        <StatCard label="Certificates" value={certCount} icon={Award} tone="success" href="/dashboard/certificates" />
      </div>

      {me && (
        <Card className="mt-6 border-border/60">
          <CardHeader>
            <CardTitle>Course progress</CardTitle>
            <p className="text-xs text-muted-foreground">{overview.course_title || me.course} · {overview.batch || me.batch}</p>
          </CardHeader>
          <CardContent>
            <Progress value={progressVal} className="h-2" />
            <p className="mt-2 text-sm text-muted-foreground">{progressVal}% complete {paid ? "· Enrollment active" : "· Payment pending"}</p>
          </CardContent>
        </Card>
      )}

      <StudentCourseReview courseName={courseTitle} completed={courseCompleted} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Open assignments</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/assignments">View all <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {openAssignments.length === 0 && <p className="text-sm text-muted-foreground">No open portals right now.</p>}
            {openAssignments.slice(0, 4).map((a) => (
              <div key={a.title} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">Due {a.due}</p>
                </div>
                <Badge className="bg-success/15 text-success">Portal open</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>My tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/tasks">Board <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myTasks.slice(0, 5).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm font-medium">{t.title}</TableCell>
                    <TableCell className="text-sm">{t.due}</TableCell>
                    <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {myTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">No tasks yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <DashboardSectionLinks role={user.role} section="/dashboard" className="mt-6" />
    </>
  );
}

function DashboardHome() {
  const { isTeacher, isStudent } = useAuth();
  if (isTeacher) return <TeacherOverview />;
  if (isStudent) return <StudentOverview />;
  return <AdminOverview />;
}
