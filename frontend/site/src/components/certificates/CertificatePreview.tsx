import type { LucideIcon } from "lucide-react";
import { CERTIFICATE_REFERENCE_IMAGE } from "@/lib/certificate-canvas";

export type CertificateLayoutData = {
  studentName: string;
  courseName: string;
  certificateNumber: string;
  verificationCode?: string;
  issueDate: string;
  completionDate?: string;
  startDate?: string;
  endDate?: string;
  batchName?: string;
  grade?: string;
  instructorName?: string;
  instituteName?: string;
  collegeName?: string;
  certificateType?: string;
  supervisorName?: string;
  bodyText?: string;
  skills?: string;
};

type Props = {
  data: CertificateLayoutData;
  logoUrl?: string | null;
  className?: string;
  /** @deprecated use size="sm" */
  compact?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZE = {
  sm: {
    wrap: "max-w-[400px]",
    aspect: "aspect-[1260/890]",
    content: "left-[34%] right-[4%] px-3 py-2.5",
    certNo: "text-[5px]",
    title: "text-[22px]",
    subtitle: "text-[6px] tracking-[0.18em]",
    intro: "text-[6px] mt-1.5",
    name: "text-[16px]",
    body: "text-[5.5px] leading-[1.5]",
    date: "text-[7px] mt-1.5",
    footer: "text-[5px]",
    sign: "text-[9px]",
    signLine: "w-14",
    signName: "text-[6px]",
  },
  md: {
    wrap: "max-w-[560px]",
    aspect: "aspect-[1260/890]",
    content: "left-[34%] right-[4%] px-4 py-3",
    certNo: "text-[7px]",
    title: "text-[30px]",
    subtitle: "text-[8px] tracking-[0.2em]",
    intro: "text-[8px] mt-2",
    name: "text-[22px]",
    body: "text-[7.5px] leading-[1.55]",
    date: "text-[9px] mt-2",
    footer: "text-[7px]",
    sign: "text-[12px]",
    signLine: "w-20",
    signName: "text-[8px]",
  },
  lg: {
    wrap: "max-w-full",
    aspect: "aspect-[1260/890] min-h-[300px]",
    content: "left-[34%] right-[3%] px-6 py-5 sm:px-8",
    certNo: "text-[9px]",
    title: "text-4xl sm:text-5xl",
    subtitle: "text-xs tracking-[0.22em]",
    intro: "text-xs mt-3",
    name: "text-3xl sm:text-4xl",
    body: "text-[11px] sm:text-xs leading-relaxed",
    date: "text-sm mt-3",
    footer: "text-[10px]",
    sign: "text-lg",
    signLine: "w-28",
    signName: "text-xs",
  },
} as const;

function formatDate(d?: string) {
  if (!d) return "";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function shortDate(d?: string) {
  if (!d) return "";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function defaultBody(data: CertificateLayoutData, institute: string) {
  const college = data.collegeName || data.instituteName || "Institution";
  const start = data.startDate ? shortDate(data.startDate) : "—";
  const end = data.endDate || data.completionDate ? shortDate(data.endDate || data.completionDate) : "—";
  const skills = data.skills || "relevant technologies";
  return `student of **${college}**, completed their **${data.courseName}** at **${institute}** from **${start}** to **${end}**, gaining hands-on experience in ${skills}.`;
}

function renderBody(text: string, bodyClass: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className={`mx-auto max-w-[95%] text-center text-[#1a1a1a] ${bodyClass}`}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-bold text-[#1a1a1a]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

/** Reusable certificate preview — official template image + dynamic fields. */
export function CertificatePreview({ data, className = "", compact, size }: Props) {
  const resolvedSize = size ?? (compact ? "sm" : "sm");
  const s = SIZE[resolvedSize];
  const institute = data.instituteName || "ShikshaLab";
  const certType = (data.certificateType || "INTERNSHIP").toUpperCase();
  const body = data.bodyText || defaultBody(data, institute);
  const supervisor = data.supervisorName || data.instructorName || "Program Supervisor";
  const verifyUrl = "www.shikshalab.com/verify";

  return (
    <div className={`mx-auto w-full ${s.wrap} ${className}`}>
      <div
        className={`relative overflow-hidden bg-white shadow-md ${s.aspect}`}
        style={{
          backgroundImage: `url(${CERTIFICATE_REFERENCE_IMAGE})`,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dynamic fields over the white content column only */}
        <div className={`absolute inset-y-0 flex flex-col bg-white/95 ${s.content}`}>
          <p className={`absolute right-0 top-0 font-bold uppercase tracking-wide text-[#1a1a1a] ${s.certNo}`}>
            Certificate No. : {data.certificateNumber}
          </p>

          <div className="flex flex-1 flex-col items-center justify-center pt-3 text-center">
            <h2
              className={`font-normal leading-none text-[#16305c] ${s.title}`}
              style={{ fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" }}
            >
              Certificate
            </h2>
            <p className={`mt-0.5 font-bold uppercase text-[#1a1a1a] ${s.subtitle}`}>OF {certType}</p>

            <p className={`text-[#333] ${s.intro}`}>This is to certify that</p>

            <p
              className={`mt-0.5 font-normal leading-tight text-[#b8953e] ${s.name}`}
              style={{ fontFamily: "'Great Vibes', 'Segoe Script', 'Brush Script MT', cursive" }}
            >
              {data.studentName}
            </p>

            <div className="mt-1.5 w-full">{renderBody(body, s.body)}</div>

            <p className={`font-bold text-[#1a1a1a] ${s.date}`}>
              {formatDate(data.issueDate) || data.issueDate}
            </p>
          </div>

          <div className={`mt-auto flex items-end justify-between gap-2 ${s.footer}`}>
            <div className="text-center">
              <p
                className={`mb-0.5 leading-none text-[#111] ${s.sign}`}
                style={{ fontFamily: "'Great Vibes', 'Segoe Script', cursive" }}
              >
                {supervisor.split(" ")[0]}
              </p>
              <div className={`mx-auto mb-0.5 border-t border-[#1a1a1a]/70 ${s.signLine}`} />
              <p className={`font-bold text-[#16305c] ${s.signName}`}>{supervisor}</p>
              <p className="text-[#555]">Supervisor</p>
            </div>

            <div className="text-right">
              <p className="font-bold text-[#16305c]">Verify At:</p>
              <p className="text-[#16305c]">{verifyUrl}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type StatProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "primary" | "highlight" | "success" | "info";
};

export function CertificateStatCard({ label, value, icon: Icon, tone = "primary" }: StatProps) {
  const iconBg = {
    primary: "bg-[#16305c] text-white",
    highlight: "bg-[#f59e0d] text-white",
    success: "bg-success text-white",
    info: "bg-info text-white",
  }[tone];

  return (
    <div className="card-soft relative overflow-hidden p-5">
      <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-[#16305c]" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
      <div className="absolute bottom-0 left-0 top-0 w-3 bg-[#d4af37]/30" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
      <div className="relative flex items-start justify-between pl-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <span className={`grid h-11 w-11 place-items-center rounded-full border-2 border-[#d4af37] ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
