"use client";

import { ArrowDown, ArrowUp, CaretLeft, CaretRight, MagnifyingGlass, UsersThree, WhatsappLogo } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/app/app-shell";
import { CustomerChip, Kpi, Money } from "@/components/app/bits";
import { dayMonth, inDays, nextOccasion, SEGMENT, statsByCustomer, TAG_LABEL, TAG_TONE, upcomingOccasions } from "@/components/app/growth";
import { Badge, Button, Card, Empty, Input, Select, cx } from "@/components/ui";
import { naira } from "@/lib/engine";
import { ago, money, pct } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { useDemo } from "@/lib/store";
import type { Segment } from "@/lib/types";

const PER_PAGE = 25;
type SortKey = "spend" | "last";

export default function CustomersPage() {
  const customers = useDemo((s) => s.customers);
  const orders = useDemo((s) => s.orders);
  const zones = useDemo((s) => s.zones);
  const now = useNow();

  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<"" | Segment>("");
  const [tag, setTag] = useState("");
  const [zone, setZone] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "spend", dir: "desc" });
  const [page, setPage] = useState(0);

  const stats = useMemo(() => statsByCustomer(orders), [orders]);

  const kpis = useMemo(() => {
    const withOrders = customers.filter((c) => (stats.get(c.id)?.count ?? 0) > 0);
    const repeat = withOrders.filter((c) => stats.get(c.id)!.count >= 2).length;
    const spend = withOrders.reduce((t, c) => t + stats.get(c.id)!.spend, 0);
    return {
      total: customers.length,
      ordering: withOrders.length,
      repeatRate: withOrders.length ? repeat / withOrders.length : 0,
      avgSpend: withOrders.length ? spend / withOrders.length : 0,
      occasions: upcomingOccasions(customers, now, 30).length,
    };
  }, [customers, stats, now]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const list = customers.filter((c) => {
      if (segment && c.segment !== segment) return false;
      if (tag && !c.tags.includes(tag)) return false;
      if (zone && c.zoneId !== zone) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        (c.instagram ?? "").toLowerCase().includes(needle.replace(/^@?/, "")) ||
        (c.company ?? "").toLowerCase().includes(needle) ||
        (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))
      );
    });
    const val = (id: string) => (sort.key === "spend" ? stats.get(id)?.spend ?? 0 : new Date(stats.get(id)?.last ?? 0).getTime());
    return list.sort((a, b) => (sort.dir === "desc" ? val(b.id) - val(a.id) : val(a.id) - val(b.id)));
  }, [customers, q, segment, tag, zone, sort, stats]);

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);
  const filtered = Boolean(q || segment || tag || zone);

  const setFilter = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };
  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
    setPage(0);
  };

  const sortHead = (k: SortKey, children: React.ReactNode) => (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === "desc" ? "descending" : "ascending") : "none"} className="px-3 py-2.5 font-medium">
      <button onClick={() => toggleSort(k)} className={cx("inline-flex items-center gap-1 hover:text-ink", sort.key === k && "text-ink")}>
        {children}
        {sort.key === k && (sort.dir === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  );

  return (
    <div>
      <PageHead title="Customers" sub="Every customer from Instagram, WhatsApp, the website and the academy, with their spend, occasions and consent in one place." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total customers" value={kpis.total.toLocaleString()} sub={`${kpis.ordering} have ordered`} />
        <Kpi label="Repeat rate" value={pct(kpis.repeatRate, 0)} sub="2+ orders, of customers who ordered" />
        <Kpi label="Average lifetime spend" value={money(kpis.avgSpend)} sub={`${naira(kpis.avgSpend)} per ordering customer`} />
        <Kpi label="Occasions in 30 days" value={kpis.occasions} sub="Birthdays and anniversaries to remind" />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-2 border-b border-line p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <MagnifyingGlass size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setFilter(setQ)(e.target.value)} placeholder="Search name, phone, Instagram or company" aria-label="Search customers" className="ps-9" />
          </div>
          <Select value={segment} onChange={(e) => setFilter(setSegment)(e.target.value as "" | Segment)} aria-label="Filter by segment" className="lg:w-40">
            <option value="">All segments</option>
            {(Object.keys(SEGMENT) as Segment[]).map((s) => (
              <option key={s} value={s}>{SEGMENT[s].label}</option>
            ))}
          </Select>
          <Select value={tag} onChange={(e) => setFilter(setTag)(e.target.value)} aria-label="Filter by tag" className="lg:w-40">
            <option value="">All tags</option>
            {["vip", "repeat", "first-order", "lead"].map((t) => (
              <option key={t} value={t}>{TAG_LABEL[t]}</option>
            ))}
          </Select>
          <Select value={zone} onChange={(e) => setFilter(setZone)(e.target.value)} aria-label="Filter by zone" className="lg:w-44">
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </Select>
        </div>

        {shown.length === 0 ? (
          <Empty icon={<UsersThree size={28} />} title="No customers match" sub="Try a different search or clear the filters." action={filtered && <Button variant="secondary" size="sm" onClick={() => { setQ(""); setSegment(""); setTag(""); setZone(""); setPage(0); }}>Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <thead className="text-xs text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Segment</th>
                  <th scope="col" className="px-3 py-2.5 text-end font-medium">Orders</th>
                  {sortHead("spend", "Lifetime spend")}
                  {sortHead("last", "Last order")}
                  <th scope="col" className="px-3 py-2.5 font-medium">Next occasion</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Tags</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const st = stats.get(c.id);
                  const next = nextOccasion(c, now);
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                      <td className="max-w-[240px] px-4 py-2.5"><CustomerChip c={c} /></td>
                      <td className="px-3 py-2.5"><Badge tone={SEGMENT[c.segment].tone}>{SEGMENT[c.segment].label}</Badge></td>
                      <td className="tnum px-3 py-2.5 text-end text-ink">{st?.count ?? 0}</td>
                      <td className="px-3 py-2.5 font-medium text-ink"><Money ngn={st?.spend ?? 0} /></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{st?.last ? ago(st.last, now) : <span className="text-ink-3">Never</span>}</td>
                      <td className="px-3 py-2.5">
                        {next ? (
                          <span className="block">
                            <span className="block truncate text-ink">{next.label}</span>
                            <span className={cx("block text-xs", next.days <= 14 ? "text-accent" : "text-ink-3")}>{dayMonth(next.at)} · {inDays(next.days)}</span>
                          </span>
                        ) : (
                          <span className="text-ink-3">None saved</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((t) => (
                            <Badge key={t} tone={TAG_TONE[t] ?? "neutral"}>{TAG_LABEL[t] ?? t}</Badge>
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {c.consentWhatsApp ? (
                          <span className="inline-flex items-center gap-1 text-xs text-ok"><WhatsappLogo size={15} weight="fill" /> Opted in</span>
                        ) : (
                          <span className="text-xs text-ink-3">No consent</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[13px] text-ink-3">
          <span className="tnum">
            {rows.length ? `${current * PER_PAGE + 1}-${Math.min(rows.length, (current + 1) * PER_PAGE)} of ${rows.length}` : "0 customers"}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page"><CaretLeft size={14} /></Button>
            <span className="tnum">Page {current + 1} of {pages}</span>
            <Button variant="ghost" size="sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Next page"><CaretRight size={14} /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
