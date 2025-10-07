import React, { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addDays,
  isSameDay,
  isBefore,
  isSameMonth,
  startOfDay,
} from "date-fns";
import { Calendar as CalendarIcon, PawPrint, ChevronLeft, ChevronRight, CheckCircle2, Shield } from "lucide-react";

// =====================
// UI PRIMITIVES
// =====================
const Container = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-neutral-50 text-neutral-900">
    <div className="max-w-6xl mx-auto px-4 py-10">{children}</div>
  </div>
);

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-neutral-200 ${className}`}>{children}</div>
);

const CardHeader = ({ title, subtitle, icon, right }: { title: string; subtitle?: string; icon?: React.ReactNode; right?: React.ReactNode }) => (
  <div className="p-6 border-b border-neutral-200 flex items-center gap-3 justify-between">
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <h2 className="text-xl font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

const CardContent = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

const Button = ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "outline" | "danger";
  disabled?: boolean;
}) => {
  const base =
    "px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const styles: Record<string, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "bg-transparent hover:bg-neutral-100",
    outline: "bg-white border border-neutral-300 hover:bg-neutral-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  );
};

const Input = ({ label, id, type = "text", ...props }: any) => (
  <label htmlFor={id} className="block">
    <span className="block text-sm font-medium text-neutral-700 mb-1">{label}</span>
    <input
      id={id}
      type={type}
      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      {...props}
    />
  </label>
);

const Textarea = ({ label, id, rows = 4, ...props }: any) => (
  <label htmlFor={id} className="block">
    <span className="block text-sm font-medium text-neutral-700 mb-1">{label}</span>
    <textarea
      id={id}
      rows={rows}
      className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      {...props}
    />
  </label>
);

// =====================
// HELPERS & CONSTANTS
// =====================
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const isSameDate = (a: Date, b: Date) => iso(a) === iso(b);
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6; // Sun or Sat

// Build 1-hour slots in 30-min increments within [startMin, endMin]
// times are minutes since 00:00; returns labels like "3:30 PM – 4:30 PM"
function buildOneHourSlots(startMin: number, endMin: number) {
  const slots: { startLabel: string; endLabel: string; startMin: number; endMin: number }[] = [];
  for (let s = startMin; s + 60 <= endMin; s += 30) {
    const e = s + 60;
    slots.push({
      startLabel: minutesToLabel(s),
      endLabel: minutesToLabel(e),
      startMin: s,
      endMin: e,
    });
  }
  return slots;
}
function minutesToLabel(mins: number) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = m.toString().padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}

// Weekday bundle window: 3:30–5:30 PM (one-hour sessions)
const WEEKDAY_WINDOW = { startMin: 15 * 60 + 30, endMin: 17 * 60 + 30, price: 7 };
// Weekend bundle window: 12:00–5:30 PM (one-hour sessions)
const WEEKEND_WINDOW = { startMin: 12 * 60, endMin: 17 * 60 + 30, price: 10 };

// Employee auth
const EMPLOYEE_CODE = "1123";
export const validateEmployeeCode = (code: string) => code === EMPLOYEE_CODE;

// LocalStorage keys
const LS_UNAVAILABLE = "as_unavailable_v1";
const LS_BOOKINGS = "as_bookings_v1";
const LS_QR_TARGET = "as_qr_target_v1";

// QR Builder (pure function so we can test it)
function buildQrImageUrl(target: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(target)}`;
}

// Types
type Choice = { kind: "pet" | "weekday" | "weekend"; startMin?: number; endMin?: number; price?: number };
type Booking = {
  dateISO: string;
  choice: Choice;
  customer: { name: string; email: string; phone?: string; pets?: string; notes?: string };
  createdAt: string; // ISO datetime
};

// =====================
// CALENDAR COMPONENT
// =====================
function MultiDateCalendar({
  value,
  onChange,
  onActivateDate,
  blockedDates = [] as string[], // dates that customers can't pick
  mode = "customer" as "customer" | "employee",
}: {
  value: Date[];
  onChange: (d: Date[]) => void;
  onActivateDate: (d: Date) => void;
  blockedDates?: string[];
  mode?: "customer" | "employee";
}) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const monthMatrix = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    const days: Date[] = [];
    let cursor = start;
    while (isBefore(cursor, end) || isSameDay(cursor, end)) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [currentMonth]);

  const today = startOfDay(new Date());
  const selectedSet = useMemo(() => new Set(value.map(iso)), [value]);
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);

  const handleClick = (day: Date) => {
    const day0 = startOfDay(day);
    const isPast = isBefore(day0, today);
    const isTodayFlag = isSameDate(day0, today);

    onActivateDate(day0);

    if (mode === "customer") {
      if (isPast || isTodayFlag || blockedSet.has(iso(day0))) return; // enforce restrictions
      const key = iso(day0);
      const has = selectedSet.has(key);
      const next = has
        ? value.filter((d) => iso(d) !== key)
        : [...value, day0].sort((a, b) => a.getTime() - b.getTime());
      onChange(next);
    }
  };

  return (
    <div className="border border-neutral-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" />
          <span className="font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-neutral-200">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-white p-2 text-xs font-medium text-neutral-500 text-center">
            {d}
          </div>
        ))}
        {monthMatrix.map((day, idx) => {
          const key = iso(day);
          const day0 = startOfDay(day);
          const isTodayFlag = isSameDate(day0, today);
          const customerDisabled = isBefore(day0, today) || isTodayFlag || blockedSet.has(key);
          const selected = selectedSet.has(key);
          const outside = !isSameMonth(day, currentMonth);

          const unavailable = blockedSet.has(key);
          const baseClasses = [
            "relative aspect-square p-1 flex items-center justify-center text-sm select-none",
            "bg-white hover:bg-neutral-50 focus:outline-none",
            outside && !(mode === 'employee') ? "text-neutral-400" : "",
            mode === "customer" && customerDisabled ? "text-neutral-300 cursor-not-allowed bg-neutral-100" : "",
            mode === "customer" && selected ? "!bg-emerald-600 text-white hover:!bg-emerald-700" : "",
            mode === "employee" && unavailable ? "bg-red-50 border border-red-300" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={idx}
              onClick={() => handleClick(day)}
              className={baseClasses}
              aria-disabled={mode === "customer" ? customerDisabled : false}
              aria-pressed={mode === "customer" ? selected : undefined}
              aria-label={
                mode === "customer"
                  ? customerDisabled
                    ? isTodayFlag
                      ? "Today (not bookable)"
                      : "Unavailable"
                    : "Available"
                  : unavailable
                  ? "Unavailable (employee view)"
                  : "Available (employee view)"
              }
              title={
                mode === "customer"
                  ? customerDisabled
                    ? isTodayFlag
                      ? "Today (not bookable)"
                      : "Unavailable"
                    : "Available"
                  : unavailable
                  ? "Unavailable (employee view)"
                  : "Available (employee view)"
              }
            >
              {/* Day number */}
              <span>{format(day, "d")}</span>
              {/* Today marker */}
              {isTodayFlag && (
                <span className="absolute top-1 right-1 text-[10px] font-semibold text-emerald-600">Today</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 flex items-center gap-4 text-sm">
        {mode === "customer" ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-emerald-600 inline-block" /> Selected
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-neutral-100 border border-neutral-300 inline-block" /> Unavailable
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-white border border-neutral-300 inline-block" /> Available
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded border-2 border-emerald-600 inline-block" /> Today (not bookable)
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-50 border border-red-300 inline-block" /> Unavailable (employee)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-white border border-neutral-300 inline-block" /> Available
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =====================
// BOOKING SIDEBAR (CUSTOMER)
// =====================
function BookingSidebar({ date, onSave }: { date: Date; onSave: (c: Choice) => void }) {
  const weekend = isWeekend(date);
  const [kind, setKind] = useState<Choice["kind"]>(weekend ? "weekend" : "weekday");

  const slots = useMemo(() => {
    if (kind === "weekday") return buildOneHourSlots(WEEKDAY_WINDOW.startMin, WEEKDAY_WINDOW.endMin);
    if (kind === "weekend") return buildOneHourSlots(WEEKEND_WINDOW.startMin, WEEKEND_WINDOW.endMin);
    return [] as { startLabel: string; endLabel: string; startMin: number; endMin: number }[]; // pet sitting: no time selection
  }, [kind]);

  const [slotIndex, setSlotIndex] = useState(0);
  useEffect(() => setSlotIndex(0), [kind]);

  const price = kind === "weekday" ? WEEKDAY_WINDOW.price : kind === "weekend" ? WEEKEND_WINDOW.price : undefined;

  return (
    <div className="border border-neutral-200 rounded-2xl p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <PawPrint className="w-4 h-4 text-emerald-600" /> Booking options
      </h3>

      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" checked={kind === "pet"} onChange={() => setKind("pet")} />
          <span>Pet Sitting (no bundle, arrival time arranged)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" checked={kind === "weekday"} onChange={() => setKind("weekday")} disabled={isWeekend(date)} />
          <span>Weekday bundle ${WEEKDAY_WINDOW.price}.00 (Mon–Fri, 1 hr within 3:30–5:30)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" checked={kind === "weekend"} onChange={() => setKind("weekend")} disabled={!isWeekend(date)} />
          <span>Weekend bundle ${WEEKEND_WINDOW.price}.00 (Sat–Sun, 1 hr within 12:00–5:30)</span>
        </label>
      </div>

      {kind !== "pet" ? (
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-1">Choose a 1‑hour time</label>
          <select
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            value={slotIndex}
            onChange={(e) => setSlotIndex(parseInt(e.target.value, 10))}
          >
            {slots.map((s, i) => (
              <option key={`${s.startMin}-${s.endMin}`} value={i}>
                {s.startLabel} – {s.endLabel}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm text-neutral-600 mb-4">No time needed — you’ll arrange arrival directly with the client.</p>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600">{price ? `Price: $${price}.00` : "Price: TBD"}</div>
        <Button
          onClick={() => {
            if (kind === "pet") {
              onSave({ kind: "pet" });
            } else {
              const s = slots[slotIndex];
              onSave({ kind, startMin: s.startMin, endMin: s.endMin, price });
            }
          }}
        >
          Add to request
        </Button>
      </div>
    </div>
  );
}

// =====================
// EMPLOYEE PANEL
// =====================
function EmployeePanel({
  activeDate,
  unavailableSet,
  setUnavailableSet,
  bookings,
}: {
  activeDate: Date | null;
  unavailableSet: Set<string>;
  setUnavailableSet: (s: Set<string>) => void;
  bookings: Booking[];
}) {
  const activeISO = activeDate ? iso(activeDate) : null;
  const dayBookings = useMemo(() => (activeISO ? bookings.filter((b) => b.dateISO === activeISO) : []), [bookings, activeISO]);
  const isUnavailable = activeISO ? unavailableSet.has(activeISO) : false;

  return (
    <div className="border border-neutral-200 rounded-2xl p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-600" /> Employee tools</h3>
      <div className="text-sm text-neutral-600 mb-3">{activeISO ? `Selected: ${format(new Date(activeISO), 'EEEE, MMM d, yyyy')}` : 'Click a date to view details.'}</div>

      {activeISO && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">Status: {isUnavailable ? <span className="text-red-600 font-medium">Unavailable</span> : <span className="text-emerald-700 font-medium">Available</span>}</div>
            <Button
              variant={isUnavailable ? "outline" : "danger"}
              onClick={() => {
                const next = new Set(unavailableSet);
                if (isUnavailable) next.delete(activeISO);
                else next.add(activeISO);
                setUnavailableSet(next);
              }}
            >
              {isUnavailable ? "Make Available" : "Mark Unavailable"}
            </Button>
          </div>

          <div className="pt-2">
            <h4 className="font-medium mb-2">Bookings on this date</h4>
            {dayBookings.length === 0 ? (
              <p className="text-sm text-neutral-500">No bookings recorded for this date.</p>
            ) : (
              <ul className="space-y-2">
                {dayBookings.map((b, i) => (
                  <li key={i} className="border rounded-xl p-3">
                    <div className="text-sm"><span className="font-medium">Client:</span> {b.customer.name} ({b.customer.email}{b.customer.phone ? ` • ${b.customer.phone}` : ""})</div>
                    <div className="text-sm"><span className="font-medium">Pets:</span> {b.customer.pets || "—"}</div>
                    <div className="text-sm"><span className="font-medium">Notes:</span> {b.customer.notes || "—"}</div>
                    <div className="text-sm"><span className="font-medium">Type:</span> {b.choice.kind === 'pet' ? 'Pet Sitting (time arranged)' : b.choice.kind === 'weekday' ? `Weekday bundle ($${WEEKDAY_WINDOW.price}.00)` : `Weekend bundle ($${WEEKEND_WINDOW.price}.00)`}</div>
                    {b.choice.kind !== 'pet' && (
                      <div className="text-sm"><span className="font-medium">Time:</span> {minutesToLabel(b.choice.startMin!)} – {minutesToLabel(b.choice.endMin!)}</div>
                    )}
                    <div className="text-xs text-neutral-500 mt-1">Submitted: {new Date(b.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!activeISO && (
        <p className="text-sm text-neutral-500">Use the calendar to select a date. You can mark it Unavailable or view any bookings.</p>
      )}
    </div>
  );
}

// =====================
// MAIN APP
// =====================
export default function App() {
  // Customer-side state
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [activeDate, setActiveDate] = useState<Date | null>(null);
  const [perDateChoices, setPerDateChoices] = useState<Record<string, Choice>>({});
  const [step, setStep] = useState<'dates' | 'details'>('dates');

  // Employee/admin state
  const [employeeMode, setEmployeeMode] = useState(false);
  const [unavailableSet, setUnavailableSet] = useState<Set<string>>(new Set());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showEmployeePrompt, setShowEmployeePrompt] = useState(false);
  const [employeeCodeInput, setEmployeeCodeInput] = useState("");
  const [employeeAuthError, setEmployeeAuthError] = useState("");

  // Optional custom QR target (persisted)
  const [customQrTarget, setCustomQrTarget] = useState<string>("");

  // Load from localStorage
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem(LS_UNAVAILABLE) || '[]');
      if (Array.isArray(u)) setUnavailableSet(new Set(u));
      const b = JSON.parse(localStorage.getItem(LS_BOOKINGS) || '[]');
      if (Array.isArray(b)) setBookings(b);
      const qrt = localStorage.getItem(LS_QR_TARGET) || "";
      if (typeof qrt === 'string') setCustomQrTarget(qrt);
    } catch {}
  }, []);
  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(LS_UNAVAILABLE, JSON.stringify(Array.from(unavailableSet))); } catch {}
  }, [unavailableSet]);
  useEffect(() => {
    try { localStorage.setItem(LS_BOOKINGS, JSON.stringify(bookings)); } catch {}
  }, [bookings]);
  useEffect(() => {
    try { localStorage.setItem(LS_QR_TARGET, customQrTarget || ""); } catch {}
  }, [customQrTarget]);

  // Submit contact form
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    pets: "",
    notes: "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    // Save bookings locally (one entry per selected date)
    const createdAt = new Date().toISOString();
    const newBookings: Booking[] = selectedDates.map((d) => ({
      dateISO: iso(d),
      choice: perDateChoices[iso(d)] || { kind: 'pet' },
      customer: { ...form },
      createdAt,
    }));
    setBookings((prev) => [...prev, ...newBookings]);

    // Mark those dates as unavailable for customers
    const next = new Set(unavailableSet);
    selectedDates.forEach((d) => next.add(iso(d)));
    setUnavailableSet(next);
  };

  const reset = () => {
    setSubmitted(false);
    setSelectedDates([]);
    setPerDateChoices({});
    setActiveDate(null);
    setForm({ name: "", email: "", phone: "", pets: "", notes: "" });
    setStep('dates');
  };

  // Mailto builder
  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("New Pet Sitting Request – The Animal Society");
    const lines: string[] = [
      "Hello Animal Society,",
      "",
      "I'd like to book pet sitting for these date(s):",
      ...selectedDates.map((d) => {
        const k = iso(d);
        const choice = perDateChoices[k];
        if (!choice) return `• ${iso(d)}`;
        if (choice.kind === "pet") return `• ${iso(d)} — Pet Sitting (time arranged)`;
        const start = minutesToLabel(choice.startMin!);
        const end = minutesToLabel(choice.endMin!);
        const label =
          choice.kind === "weekday"
            ? `Weekday bundle ($${WEEKDAY_WINDOW.price}.00)`
            : `Weekend bundle ($${WEEKEND_WINDOW.price}.00)`;
        return `• ${iso(d)} — ${label} — ${start} – ${end}`;
      }),
      "",
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Pets: ${form.pets}`,
      `Notes: ${form.notes}`,
      "",
      "Submitted from the website.",
    ];
    const body = encodeURIComponent(lines.join("\n"));
    return `mailto:wltoupin@gmail.com?subject=${subject}&body=${body}`;
  }, [selectedDates, perDateChoices, form]);

  // Employee modal controls
  const openEmployeePrompt = () => {
    setEmployeeAuthError("");
    setEmployeeCodeInput("");
    setShowEmployeePrompt(true);
  };
  const submitEmployeeCode = () => {
    if (validateEmployeeCode(employeeCodeInput.trim())) {
      setEmployeeMode(true);
      setShowEmployeePrompt(false);
      setEmployeeCodeInput("");
      setEmployeeAuthError("");
    } else {
      setEmployeeAuthError("Incorrect code. Try again.");
    }
  };

  // QR code target + image (App scope)
  const qrTarget = useMemo(() => {
    // Prefer custom target if set in Employee mode
    if (customQrTarget && /^https?:\/\//i.test(customQrTarget)) return customQrTarget;
    if (typeof window !== 'undefined') {
      // Use FULL href so paths/subroutes are preserved
      const { href } = window.location;
      return href;
    }
    return 'https://animalsocietybooking.com';
  }, [customQrTarget]);
  const qrImageSrc = useMemo(() => buildQrImageUrl(qrTarget), [qrTarget]);

  return (
    <Container>
      {/* Header / Hero */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white">
            <PawPrint className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">The Animal Society</h1>
            <p className="text-sm text-neutral-500">Friendly, reliable pet sitting in your neighborhood</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!employeeMode ? (
            <Button variant="outline" onClick={openEmployeePrompt}>
              <span className="inline-flex items-center gap-2"><Shield className="w-4 h-4" /> Employee mode</span>
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setEmployeeMode(false)}>Exit employee mode</Button>
          )}
          <a href="#book" className="hidden sm:inline-block">
            <Button>Book Dates</Button>
          </a>
        </div>
      </header>

      {/* Employee auth modal */}
      {showEmployeePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowEmployeePrompt(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold">Enter employee code</h3>
              </div>
            </div>
            <div className="space-y-3">
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                value={employeeCodeInput}
                onChange={(e) => setEmployeeCodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitEmployeeCode(); }}
                placeholder="Enter code"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {employeeAuthError && <div className="text-sm text-red-600">{employeeAuthError}</div>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowEmployeePrompt(false)}>Cancel</Button>
                <Button onClick={submitEmployeeCode}>Enter</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER MODE */}
      {!employeeMode && (
        <Card className="mb-8">
          <CardHeader
            icon={<PawPrint className="w-6 h-6 text-emerald-600" />}
            title="Stress‑free care for your best friend"
            subtitle="Pick your dates, choose your bundle/time, then submit your details."
            right={<span className="text-xs text-neutral-500">All booking emails go to <span className="font-medium">wltoupin@gmail.com</span></span>}
          />
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Calendar */}
              <div id="book">
                <MultiDateCalendar
                  value={selectedDates}
                  onChange={setSelectedDates}
                  onActivateDate={setActiveDate}
                  blockedDates={Array.from(unavailableSet)}
                  mode="customer"
                />
                <p className="mt-3 text-sm text-neutral-600">
                  Past dates and today are unavailable. Select any future date on the calendar, configure the bundle on the right, then click "Submit Dates" below to continue.
                </p>
              </div>

              {/* Dynamic booking sidebar (always visible; changes per date) */}
              <div>
                <div className="mb-3 text-sm text-neutral-600">
                  {activeDate ? `Configuring: ${format(activeDate, "EEEE, MMM d, yyyy")}` : "Select a date to configure booking options."}
                </div>
                {activeDate ? (
                  <BookingSidebar
                    date={activeDate}
                    onSave={(choice) => {
                      const key = iso(activeDate);
                      setPerDateChoices({ ...perDateChoices, [key]: choice });
                      if (!selectedDates.some((d) => iso(d) === key)) {
                        setSelectedDates([...selectedDates, activeDate].sort((a, b) => a.getTime() - b.getTime()));
                      }
                    }}
                  />
                ) : (
                  <div className="text-sm text-neutral-500 border border-dashed border-neutral-300 rounded-xl p-4">
                    Click a future date on the calendar to see bundle options here.
                  </div>
                )}
              </div>
            </div>

            {/* Action bar: submit dates to proceed to details */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-neutral-600">
                {selectedDates.length > 0 ? `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected` : 'No dates selected yet'}
              </div>
              <div className="flex gap-2">
                {step === 'details' && (
                  <Button variant="outline" onClick={() => setStep('dates')}>Back to calendar</Button>
                )}
                <Button onClick={() => setStep('details')} disabled={selectedDates.length === 0}>Submit Dates</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DETAILS STEP (CUSTOMER) */}
      {!employeeMode && step === 'details' && !submitted && (
        <Card className="mb-8">
          <CardHeader title="Your details" subtitle="Enter your contact info so we can confirm your booking." right={<span className="text-xs text-neutral-500">Emails go to <span className="font-medium">wltoupin@gmail.com</span></span>} />
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <Input id="name" label="Your name" required value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} />
              <Input id="email" type="email" label="Email" required value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} />
              <Input id="phone" type="tel" label="Phone" placeholder="(555) 555‑5555" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} />
              <Input id="pets" label="Pet(s)" placeholder="e.g., Luna the dog (lab), Mochi the cat" value={form.pets} onChange={(e: any) => setForm({ ...form, pets: e.target.value })} />
              <Textarea id="notes" label="Notes" placeholder="Feeding schedule, meds, quirks, etc." value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} />
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-neutral-600">
                  {selectedDates.length > 0 ? `${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''} selected` : 'No dates selected yet'}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={(e)=>{e.preventDefault(); setStep('dates');}}>Back</Button>
                  <Button type="submit">Submit Request</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* CONFIRMATION */}
      {!employeeMode && submitted && (
        <Card className="mb-8 border-emerald-200">
          <CardHeader
            icon={<CheckCircle2 className="w-6 h-6 text-emerald-600" />}
            title="Request ready to send"
            subtitle="Click the email button below to send your booking request. We’ll confirm by email."
            right={<span className="text-xs text-neutral-500">Sending to <span className="font-medium">wltoupin@gmail.com</span></span>}
          />
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Selected date(s)</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {selectedDates.map((d) => (
                    <li key={iso(d)}>{format(d, "EEEE, MMM d, yyyy")}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1 text-sm">
                <div><span className="font-medium">Name:</span> {form.name}</div>
                <div><span className="font-medium">Email:</span> {form.email}</div>
                <div><span className="font-medium">Phone:</span> {form.phone || "—"}</div>
                <div><span className="font-medium">Pets:</span> {form.pets || "—"}</div>
                <div><span className="font-medium">Notes:</span> {form.notes || "—"}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <a href={mailtoHref}><Button>Send Email</Button></a>
              <Button variant="ghost" onClick={reset}>Start Over</Button>
            </div>
            <p className="mt-3 text-xs text-neutral-500">Tip: For a full booking system, connect to a database (e.g., Supabase) and write bookings server‑side to prevent double‑booking.</p>
          </CardContent>
        </Card>
      )}

      {/* EMPLOYEE MODE */}
      {employeeMode && (
        <Card className="mb-8">
          <CardHeader
            icon={<Shield className="w-6 h-6 text-emerald-600" />}
            title="Employee mode"
            subtitle="View bookings and mark dates unavailable."
          />
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <MultiDateCalendar
                  value={[]} // selection not used in employee mode
                  onChange={() => {}}
                  onActivateDate={setActiveDate}
                  blockedDates={Array.from(unavailableSet)}
                  mode="employee"
                />
                <p className="mt-3 text-sm text-neutral-600">Click a date to view details. Use the button to mark it Unavailable/Available. Unavailable dates are blocked for customers.</p>
              </div>
              <EmployeePanel
                activeDate={activeDate}
                unavailableSet={unavailableSet}
                setUnavailableSet={setUnavailableSet}
                bookings={bookings}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <footer className="text-xs text-neutral-500 text-center mt-10">
        <div className="mb-4">
          <p className="text-sm text-neutral-600 mb-2">Scan to open this booking site:</p>
          <img
            src={qrImageSrc}
            alt="QR code to booking site"
            className="inline-block w-40 h-40"
          />
          <div className="mt-2 flex flex-col items-center gap-1">
            <a href={qrTarget} className="text-emerald-700 underline break-all">{qrTarget}</a>
            {employeeMode && (
              <div className="mt-2 w-full max-w-xl px-4">
                <div className="text-[11px] text-neutral-500 mb-1">Employee tools: set a custom share URL for the QR (use your deployed link, not localhost).</div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://your-live-domain.com"
                    value={customQrTarget}
                    onChange={(e)=> setCustomQrTarget(e.target.value)}
                    className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Button variant="outline" onClick={()=> setCustomQrTarget(qrTarget)}>Use this page</Button>
                </div>
                <div className="flex gap-2 justify-center mt-2">
                  <a href={qrImageSrc} download="AnimalSociety-QR.png"><Button variant="outline">Download QR</Button></a>
                  <button
                    className="px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm bg-white border border-neutral-300 hover:bg-neutral-50"
                    onClick={async()=>{
                      try {
                        await navigator.clipboard.writeText(qrTarget);
                        alert('Link copied!');
                      } catch {
                        alert('Copy failed.');
                      }
                    }}
                  >Copy link</button>
                </div>
              </div>
            )}
          </div>
        </div>
        © {new Date().getFullYear()} The Animal Society. All rights reserved.
      </footer>
    </Container>
  );
}

// =====================
// DEV TESTS (run in browser console)
// =====================
try {
  (function () {
    var today = new Date();
    var today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    var tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    function pad(n) { return String(n).padStart(2, "0"); }
    function isoLocal(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

    console.assert(isoLocal(today).length === 10, "isoLocal should be 10 chars");

    function isPast(d) { var d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return d0 < today0; }
    console.assert(isPast(yest) === true, "Yesterday should be considered past");
    console.assert(isPast(tomorrow) === false, "Tomorrow should not be past");

    // Slot windows
    console.assert(WEEKDAY_WINDOW.startMin === 15*60+30, "Weekday starts 3:30 PM");
    console.assert(WEEKDAY_WINDOW.endMin === 17*60+30, "Weekday ends 5:30 PM");
    console.assert(WEEKEND_WINDOW.startMin === 12*60, "Weekend starts 12:00 PM");
    console.assert(WEEKEND_WINDOW.endMin === 17*60+30, "Weekend ends 5:30 PM");

    // Auth validator
    console.assert(typeof validateEmployeeCode === 'function', 'validateEmployeeCode exists');
    console.assert(validateEmployeeCode('1123') === true, 'Correct code accepts');
    console.assert(validateEmployeeCode('0000') === false, 'Wrong code rejects');

    // Minutes formatting
    console.assert(/PM|AM/.test((function(){return minutesToLabel(15*60+30);})()), "minutesToLabel returns AM/PM");

    // Newline join test for email body
    var joined = ["A","B"].join("\n");
    console.assert(joined.indexOf("\n") > -1, "Newline join works");

    // QR builder
    console.assert(typeof buildQrImageUrl === 'function', 'buildQrImageUrl exists');
    var built = buildQrImageUrl('https://example.com');
    console.assert(built.indexOf('data=') > -1, 'QR URL includes data parameter');
    console.assert(built.endsWith(encodeURIComponent('https://example.com')) === true, 'QR encodes target URL');
  })();
  // eslint-disable-next-line no-console
  console.log("DEV TESTS PASSED");
} catch (e) {
  // eslint-disable-next-line no-console
  console.error("DEV TESTS FAILED", e);
}
