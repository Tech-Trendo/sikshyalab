import { useEffect, useState } from "react";
import { fetchEnrollmentTrends, fetchRevenueSummary, type RevenueSummary } from "@/lib/dashboard-api";
import { mapEnrollmentChart, mapRevenueChart } from "@/lib/dashboard-mappers";

export function useAdminAnalytics(months = 6) {
  const [revenue, setRevenue] = useState<{ month: string; revenue: number }[]>([]);
  const [enrollments, setEnrollments] = useState<{ month: string; students: number }[]>([]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [rev, enr] = await Promise.all([
        fetchRevenueSummary(months),
        fetchEnrollmentTrends(months),
      ]);
      if (cancelled) return;
      if (rev?.series?.length || enr?.series?.length) {
        setRevenue(mapRevenueChart(rev, []));
        setEnrollments(mapEnrollmentChart(enr, []));
        setSummary(rev);
        setLive(true);
      } else {
        setRevenue([]);
        setEnrollments([]);
        setSummary(rev);
        setLive(false);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [months]);

  return { revenueSeries: revenue, enrollmentsSeries: enrollments, revenueSummary: summary, loading, live };
}
