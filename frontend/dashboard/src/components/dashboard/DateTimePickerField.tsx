import { format } from "date-fns";
import { DatePickerField } from "@/components/dashboard/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DateTimePickerFieldProps = {
  date?: Date;
  time: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
  dateLabel?: string;
  timeLabel?: string;
};

export function DateTimePickerField({
  date,
  time,
  onDateChange,
  onTimeChange,
  dateLabel = "Date",
  timeLabel = "Time",
}: DateTimePickerFieldProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label>{dateLabel}</Label>
        <div className="mt-1.5">
          <DatePickerField value={date} onChange={onDateChange} placeholder="Select date" />
        </div>
      </div>
      <div>
        <Label>{timeLabel}</Label>
        <Input
          className="mt-1.5"
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
        />
      </div>
      {date && time && (
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Closes automatically at {format(buildDateTime(date, time), "PPP p")}
        </p>
      )}
    </div>
  );
}

export function buildDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(h || 0, m || 0, 0, 0);
  return next;
}

export function formatDueLabel(iso?: string, fallback = "TBD"): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return format(d, "MMM d, yyyy h:mm a");
}
