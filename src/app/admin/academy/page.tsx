"use client";

import { useState } from "react";
import { Certificate, CheckCircle, GraduationCap, Plus, UserPlus, Wallet } from "@phosphor-icons/react";
import { PageHead } from "@/components/app/app-shell";
import { Kpi, Money } from "@/components/app/bits";
import { Avatar, Badge, Button, Card, CardHead, Empty, Field, Input, Modal, Segmented, Select, Sheet, Thumb, type Tone } from "@/components/ui";
import { enroll, naira, upsertCustomer } from "@/lib/engine";
import { createCohort, issueCertificate, markAttended, markEnrollmentPaid } from "@/lib/engine-ops";
import { dateOnly, money } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Cohort, Enrollment } from "@/lib/types";

const ENROL: Record<Enrollment["status"], { label: string; tone: Tone }> = {
  reserved: { label: "Seat reserved", tone: "warn" },
  paid: { label: "Paid", tone: "info" },
  attending: { label: "Attending", tone: "accent" },
  completed: { label: "Completed", tone: "ok" },
};

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default function AcademyPage() {
  const courses = useDemo((s) => s.courses);
  const cohorts = useDemo((s) => s.cohorts);
  const enrollments = useDemo((s) => s.enrollments);
  const now = useNow();
  const [openCohort, setOpenCohort] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const upcoming = cohorts.filter((c) => new Date(c.startDate).getTime() > now);
  const upcomingSeats = upcoming.reduce((t, c) => t + c.seats, 0);
  const upcomingFilled = upcoming.reduce((t, c) => t + c.studentIds.length, 0);
  const revenue = enrollments.reduce((t, e) => t + e.paidNGN, 0);
  const outstanding = enrollments.reduce((t, e) => {
    const course = courses.find((c) => c.id === cohorts.find((x) => x.id === e.cohortId)?.courseId);
    return t + Math.max(0, (course?.priceNGN ?? 0) - e.paidNGN);
  }, 0);
  const sortedCohorts = [...cohorts].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  return (
    <div>
      <PageHead
        title="Academy"
        icon={<GraduationCap size={26} weight="duotone" className="text-brand" />}
        sub="Seats, payments, reminders and certificates for every class. Tia books seats straight from DMs and WhatsApp."
        actions={<Button onClick={() => setCreating(true)}><Plus size={16} /> New cohort</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Students trained" value="200+" sub={`Plus ${enrollments.length} enrolments in the system`} />
        <Kpi label="Revenue from enrolments" value={money(revenue)} sub={outstanding ? `${money(outstanding)} balances outstanding` : "No balances outstanding"} />
        <Kpi label="Upcoming cohorts" value={upcoming.length} sub={upcoming.length ? `Next starts ${dateOnly([...upcoming].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0].startDate)}` : "None scheduled"} />
        <Kpi label="Seats filled" value={`${upcomingSeats ? Math.round((upcomingFilled / upcomingSeats) * 100) : 0}%`} sub={`${upcomingFilled} of ${upcomingSeats} upcoming seats`} />
      </div>

      <Card className="mt-5">
        <CardHead title="Courses" sub="Next cohort for each course" />
        <ul className="mt-2 divide-y divide-line">
          {courses.map((co) => {
            const next = cohorts.filter((c) => c.courseId === co.id && new Date(c.startDate).getTime() > now).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
            const ids = cohorts.filter((c) => c.courseId === co.id).map((c) => c.id);
            const rev = enrollments.filter((e) => ids.includes(e.cohortId)).reduce((t, e) => t + e.paidNGN, 0);
            const fill = next ? next.studentIds.length / next.seats : 0;
            return (
              <li key={co.id} className="grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-3 px-5 py-4 md:grid-cols-[56px_minmax(0,1.4fr)_minmax(0,1fr)_110px_110px_auto]">
                <Thumb src={co.image} className="h-14 w-14 rounded-xl" sizes="56px" />
                <div className="min-w-0">
                  <p className="font-medium text-ink">{co.title}</p>
                  <p className="text-xs text-ink-3">{co.level} · {co.days} day{co.days > 1 ? "s" : ""} · {co.mode.replace("-", " ")}</p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  {next ? (
                    <>
                      <p className="text-xs text-ink-3">Next cohort {longDate(next.startDate)}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-2 flex-1" role="img" aria-label={`${next.studentIds.length} of ${next.seats} seats filled`}>
                          <div className="h-2 rounded-full" style={{ width: `${Math.max(3, fill * 100)}%`, background: "var(--viz-1)" }} />
                        </div>
                        <span className="tnum shrink-0 text-xs font-semibold text-ink">{next.studentIds.length}/{next.seats}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-ink-3">No upcoming cohort</p>
                  )}
                </div>
                <div className="text-[13px]">
                  <p className="text-xs text-ink-3">Price</p>
                  <Money ngn={co.priceNGN} className="font-semibold text-ink" />
                </div>
                <div className="text-[13px]">
                  <p className="text-xs text-ink-3">Revenue</p>
                  <span className="tnum font-semibold text-ink">{money(rev)}</span>
                </div>
                <div className="col-span-2 md:col-span-1 md:text-end">
                  {next ? <Button size="sm" variant="outline" onClick={() => setOpenCohort(next.id)}>Open cohort</Button> : <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>Schedule one</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="mt-5">
        <CardHead title="All cohorts" sub="Newest first" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-y border-line text-xs text-ink-3">
                <th className="px-5 py-2 text-start font-medium">Course</th>
                <th className="px-3 py-2 text-start font-medium">Starts</th>
                <th className="px-3 py-2 text-end font-medium">Seats</th>
                <th className="px-3 py-2 text-end font-medium">Collected</th>
                <th className="px-3 py-2 text-start font-medium">Status</th>
                <th className="px-5 py-2 text-end font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedCohorts.map((ch) => {
                const course = courses.find((c) => c.id === ch.courseId);
                const past = new Date(ch.startDate).getTime() <= now;
                const paid = enrollments.filter((e) => e.cohortId === ch.id).reduce((t, e) => t + e.paidNGN, 0);
                return (
                  <tr key={ch.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5 font-medium text-ink">{course?.title}</td>
                    <td className="px-3 py-2.5 text-ink-2">{longDate(ch.startDate)}</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink-2">{ch.studentIds.length}/{ch.seats}</td>
                    <td className="tnum px-3 py-2.5 text-end text-ink">{naira(paid)}</td>
                    <td className="px-3 py-2.5"><Badge tone={past ? "neutral" : ch.studentIds.length >= ch.seats ? "bad" : "ok"}>{past ? "Run" : ch.studentIds.length >= ch.seats ? "Full" : "Open"}</Badge></td>
                    <td className="px-5 py-2.5 text-end"><Button size="sm" variant="ghost" onClick={() => setOpenCohort(ch.id)}>View students</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <CohortSheet cohortId={openCohort} onClose={() => setOpenCohort(null)} />
      <NewCohortModal open={creating} onClose={() => setCreating(false)} onCreated={(id) => setOpenCohort(id)} />
    </div>
  );
}

// ---------------------------------------------------------------- cohort detail

function CohortSheet({ cohortId, onClose }: { cohortId: string | null; onClose: () => void }) {
  const cohort = useDemo((s) => s.cohorts.find((c) => c.id === cohortId));
  const course = useDemo((s) => s.courses.find((c) => c.id === cohort?.courseId));
  return (
    <Sheet open={!!cohort} onClose={onClose} title={course ? `${course.title}` : "Cohort"} width={560}>
      {cohort && course && <CohortDetail key={cohort.id} cohort={cohort} />}
    </Sheet>
  );
}

function CohortDetail({ cohort }: { cohort: Cohort }) {
  const course = useDemo((s) => s.courses.find((c) => c.id === cohort.courseId))!;
  const enrollments = useDemo((s) => s.enrollments);
  const customers = useDemo((s) => s.customers);
  const run = useDemo((s) => s.run);
  const [adding, setAdding] = useState(false);
  const list = enrollments.filter((e) => e.cohortId === cohort.id);
  const collected = list.reduce((t, e) => t + e.paidNGN, 0);
  const full = cohort.studentIds.length >= cohort.seats;

  const act = (e: Enrollment, kind: "paid" | "attended" | "cert") => {
    const name = customers.find((c) => c.id === e.customerId)?.name ?? "Student";
    if (kind === "paid") {
      run((s) => markEnrollmentPaid(s, e.id));
      toast("Payment recorded", `${name} is fully paid. Receipt sent on WhatsApp.`);
    } else if (kind === "attended") {
      run((s) => markAttended(s, e.id));
      toast("Attendance marked", name, "info");
    } else {
      run((s) => issueCertificate(s, e.id));
      toast("Certificate issued", `Congratulations sent to ${name.split(" ")[0]} on WhatsApp.`);
    }
  };

  return (
    <div className="px-5 py-4">
      <div className="grid grid-cols-3 gap-3 text-[13px]">
        <div><p className="text-xs text-ink-3">Starts</p><p className="font-medium text-ink">{longDate(cohort.startDate)}</p></div>
        <div><p className="text-xs text-ink-3">Seats</p><p className="tnum font-medium text-ink">{cohort.studentIds.length} of {cohort.seats}</p></div>
        <div><p className="text-xs text-ink-3">Collected</p><p className="tnum font-medium text-ink">{naira(collected)}</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">Students</h3>
        <Button size="sm" onClick={() => setAdding((v) => !v)} disabled={full && !adding}>
          <UserPlus size={15} /> {full ? "Cohort full" : "Add student"}
        </Button>
      </div>
      {adding && <AddStudent cohort={cohort} coursePrice={course.priceNGN} onDone={() => setAdding(false)} />}
      {list.length === 0 ? (
        <Empty icon={<GraduationCap size={28} />} title="No students yet" sub="Add one here, or let Tia book seats from Instagram and WhatsApp." />
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {list.map((e) => {
            const c = customers.find((x) => x.id === e.customerId);
            const balance = course.priceNGN - e.paidNGN;
            return (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Avatar name={c?.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-medium text-ink">{c?.name}</p>
                      <Badge tone={ENROL[e.status].tone}>{ENROL[e.status].label}</Badge>
                      {e.certificate && <Badge tone="brand"><Certificate size={12} /> Certificate</Badge>}
                    </div>
                    <p className="text-xs text-ink-3">
                      {c?.phone} · paid <span className="tnum">{naira(e.paidNGN)}</span>
                      {balance > 0 && <span className="text-warn"> · balance {naira(balance)}</span>}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 ps-11">
                  {balance > 0 && <Button size="sm" variant="outline" onClick={() => act(e, "paid")}><Wallet size={14} /> Mark paid</Button>}
                  {(e.status === "paid" || e.status === "reserved") && <Button size="sm" variant="secondary" onClick={() => act(e, "attended")}><CheckCircle size={14} /> Mark attended</Button>}
                  {e.status !== "completed" && <Button size="sm" variant="secondary" onClick={() => act(e, "cert")}><Certificate size={14} /> Issue certificate</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddStudent({ cohort, coursePrice, onDone }: { cohort: Cohort; coursePrice: number; onDone: () => void }) {
  const customers = useDemo((s) => s.customers);
  const run = useDemo((s) => s.run);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const options = customers.filter((c) => c.segment !== "corporate" && !cohort.studentIds.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const [customerId, setCustomerId] = useState(options[0]?.id ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pay, setPay] = useState<"half" | "full" | "none">("half");
  const amount = pay === "full" ? coursePrice : pay === "half" ? coursePrice / 2 : 0;
  const valid = mode === "existing" ? !!customerId : name.trim().length > 2 && phone.replace(/\D/g, "").length >= 10;

  const save = () => {
    if (!valid) return;
    const who = run((s) => {
      const id = mode === "existing" ? customerId : upsertCustomer(s, { name: name.trim(), phone: phone.trim(), source: "class", segment: "student" }).customer.id;
      if (s.cohorts.find((c) => c.id === cohort.id)?.studentIds.includes(id)) return null;
      enroll(s, cohort.id, id, amount);
      return s.customers.find((c) => c.id === id)?.name ?? "Student";
    });
    if (!who) toast("Already enrolled", "That person already has a seat in this cohort.", "warn");
    else toast("Seat booked", `${who} added. Confirmation and class reminder sent on WhatsApp.`);
    onDone();
  };

  return (
    <form
      className="mt-3 grid gap-3 rounded-2xl border border-line bg-surface-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "existing", label: "Existing customer" }, { value: "new", label: "New student" }]} />
      {mode === "existing" ? (
        <Field label="Customer">
          {(id) => (
            <Select id={id} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {options.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
            </Select>
          )}
        </Field>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Chiamaka Obi" />}</Field>
          <Field label="WhatsApp number">{(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 803 000 0000" />}</Field>
        </div>
      )}
      <Field label="Payment">
        {(id) => (
          <Select id={id} value={pay} onChange={(e) => setPay(e.target.value as typeof pay)}>
            <option value="half">50% deposit ({naira(coursePrice / 2)})</option>
            <option value="full">Paid in full ({naira(coursePrice)})</option>
            <option value="none">Not paid yet (seat reserved)</option>
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={!valid}>Book seat</Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- new cohort

function NewCohortModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="New cohort">
      {open && <NewCohortForm onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function NewCohortForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const courses = useDemo((s) => s.courses);
  const run = useDemo((s) => s.run);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10));
  const [seats, setSeats] = useState(() => String(courses[0]?.level === "Kids" ? 15 : 12));
  const valid = courseId && date && Number(seats) > 0;

  const save = () => {
    if (!valid) return;
    const id = run((s) => createCohort(s, courseId, new Date(`${date}T10:00:00+01:00`).toISOString(), Math.round(Number(seats))));
    const course = courses.find((c) => c.id === courseId);
    toast("Cohort created", `${course?.title} on ${longDate(`${date}T10:00:00+01:00`)}. Booking is open on the website and with Tia.`);
    onClose();
    if (id) onCreated(id);
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="Course">
        {(id) => (
          <Select
            id={id}
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              const co = courses.find((c) => c.id === e.target.value);
              setSeats(String(co?.level === "Kids" ? 15 : co?.mode === "online" ? 40 : 12));
            }}
          >
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title} · {naira(c.priceNGN)}</option>)}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Start date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Seats">{(id) => <Input id={id} type="number" min={1} max={60} value={seats} onChange={(e) => setSeats(e.target.value)} />}</Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!valid}>Create cohort</Button>
      </div>
    </form>
  );
}
