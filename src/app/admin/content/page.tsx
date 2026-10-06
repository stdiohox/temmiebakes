"use client";

import Image from "next/image";
import { ArrowsClockwise, BookmarkSimple, CalendarCheck, ChatCircle, CheckCircle, Heart, PaperPlaneTilt, Sparkle, UploadSimple } from "@phosphor-icons/react";
import { useState } from "react";
import { PageHead } from "@/components/app/app-shell";
import { Bubble } from "@/components/app/growth";
import { Badge, Button, Card, CardHead, Empty, Field, Input, Logo, Modal, Segmented, Select, Skeleton, Thumb, type Tone } from "@/components/ui";
import { logEvent, naira } from "@/lib/engine";
import { ago, dateTime, uid } from "@/lib/format";
import { sleep, useNow, useStream } from "@/lib/hooks";
import { ANGLE_LABEL, generateContent, KIND_LABEL, leadText, TONE_LABEL, type ContentAngle, type ContentKind, type ContentTone } from "@/lib/sim/content";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { ContentDraft } from "@/lib/types";

const STATUS: Record<ContentDraft["status"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  approved: { label: "Approved", tone: "brand" },
  scheduled: { label: "Scheduled", tone: "info" },
  published: { label: "Published", tone: "ok" },
};

export default function ContentPage() {
  return (
    <div>
      <PageHead
        title="AI content studio"
        icon={<Sparkle size={26} weight="fill" className="text-accent" />}
        sub="Captions, Reel scripts, Stories and broadcasts written in the Koretbakes voice in seconds. Nothing goes out until you approve it."
      />
      <Studio />
      <Queue />
    </div>
  );
}

// ------------------------------------------------------------ generator

function Studio() {
  const run = useDemo((s) => s.run);
  const products = useDemo((s) => s.products);
  const [kind, setKind] = useState<ContentKind>("instagram-post");
  const [productId, setProductId] = useState(() => products.find((p) => p.tags.includes("instagram-favourite"))?.id ?? products[0]?.id ?? "");
  const [tone, setTone] = useState<ContentTone>("playful");
  const [angle, setAngle] = useState<ContentAngle>("birthday");
  const [variant, setVariant] = useState(0);
  const [phase, setPhase] = useState<"idle" | "thinking" | "streaming">("idle");
  const [result, setResult] = useState<{ title: string; body: string; kind: ContentKind; productId: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const product = products.find((p) => p.id === (result?.productId ?? productId)) ?? products[0];
  const { shown, done } = useStream(result?.body ?? "", phase === "streaming");

  const generate = async (next: number) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setVariant(next);
    setSaved(false);
    setPhase("thinking");
    await sleep(900 + Math.random() * 300);
    const out = generateContent({ kind, product: p, tone, angle, variant: next });
    setResult({ ...out, kind, productId: p.id });
    setPhase("streaming");
    useDemo.getState().run((s) => logEvent(s, { automation: "content", kind: "ai", title: `AI drafted a ${KIND_LABEL[kind].toLowerCase()}`, detail: `${p.name} · ${TONE_LABEL[tone].toLowerCase()} · ${ANGLE_LABEL[angle].toLowerCase()} angle`, minutesSaved: 12 }));
  };

  const save = () => {
    if (!result) return;
    run((s) => {
      s.content.unshift({ id: uid("ct"), kind: result.kind, productId: result.productId, title: result.title, body: result.body, status: "draft", createdAt: new Date().toISOString() });
      logEvent(s, { automation: "content", kind: "action", title: "Draft saved for approval", detail: result.title, minutesSaved: 2 });
    });
    setSaved(true);
    toast("Saved for approval", "It's waiting in the review queue below.");
  };

  const busy = phase === "thinking" || (phase === "streaming" && !done);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card className="pb-5">
        <CardHead title="Generate" sub="Pick what you need and Tia writes it." />
        <div className="mt-4 grid gap-4 px-5">
          <Field label="Content type">
            {(fid) => (
              <Select id={fid} value={kind} onChange={(e) => setKind(e.target.value as ContentKind)}>
                {(Object.keys(KIND_LABEL) as ContentKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Product">
            {(fid) => (
              <Select id={fid} value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.filter((p) => p.available).map((p) => <option key={p.id} value={p.id}>{p.name} ({naira(p.priceNGN)})</option>)}
              </Select>
            )}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Tone</p>
            <Segmented value={tone} onChange={setTone} options={(Object.keys(TONE_LABEL) as ContentTone[]).map((t) => ({ value: t, label: TONE_LABEL[t] }))} />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Occasion angle</p>
            <Segmented size="sm" className="flex-wrap" value={angle} onChange={setAngle} options={(Object.keys(ANGLE_LABEL) as ContentAngle[]).map((a) => ({ value: a, label: ANGLE_LABEL[a] }))} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => generate(result ? variant : 0)} disabled={busy}>
              <Sparkle size={16} weight="fill" /> Generate
            </Button>
            {result && (
              <Button variant="secondary" onClick={() => generate(variant + 1)} disabled={busy}>
                <ArrowsClockwise size={16} /> Regenerate
              </Button>
            )}
          </div>
        </div>

        <div className="mx-5 mt-5 rounded-xl border border-line bg-surface-2/60 p-4" aria-live="polite">
          {phase === "idle" && <p className="text-[13px] text-ink-3">Your draft will appear here. Every draft includes the price, lead time, a clear call to action and Lagos hashtags.</p>}
          {phase === "thinking" && (
            <div className="grid gap-2" aria-label="Writing">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-2/5" />
            </div>
          )}
          {phase === "streaming" && result && (
            <>
              <p className="mb-2 text-xs font-medium text-ink-3">{result.title}</p>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{shown}</p>
              {done && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={save} disabled={saved}>
                    {saved ? <CheckCircle size={14} weight="fill" /> : <BookmarkSimple size={14} />} {saved ? "Saved" : "Save for approval"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(result.body).catch(() => {}); toast("Copied to clipboard", undefined, "info"); }}>Copy text</Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <Card className="pb-5">
        <CardHead title="Preview" sub={result ? KIND_LABEL[result.kind] : KIND_LABEL[kind]} />
        <div className="mt-4 px-5">
          {product && <PostPreview kind={result?.kind ?? kind} image={product.image} name={product.name} caption={phase === "streaming" ? shown : ""} loading={phase === "thinking"} sub={`${naira(product.priceNGN)} · ${leadText(product.leadDays)}`} />}
        </div>
      </Card>
    </div>
  );
}

function PostPreview({ kind, image, name, caption, loading, sub }: { kind: ContentKind; image: string; name: string; caption: string; loading: boolean; sub: string }) {
  if (kind === "whatsapp-broadcast") {
    return (
      <div className="mx-auto max-w-sm rounded-2xl bg-surface-2 p-4">
        <p className="mb-3 text-center text-xs text-ink-3">WhatsApp broadcast preview</p>
        <div className="relative mb-2 aspect-square w-56 overflow-hidden rounded-2xl">
          <Image src={image} alt={name} fill sizes="224px" className="object-cover" />
        </div>
        {loading ? <Skeleton className="h-20 w-64 max-w-full" /> : <Bubble>{caption.replace(/\{\{firstName\}\}/g, "Adaeze") || "Message text"}</Bubble>}
      </div>
    );
  }
  return (
    <article className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <Logo size={28} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink">koretbakes</span>
          <span className="block text-[11px] text-ink-3">{kind === "story" ? "Story" : kind === "reel-script" ? "Reel" : "Ikeja, Lagos"}</span>
        </span>
      </header>
      <div className="relative aspect-square w-full">
        <Image src={image} alt={name} fill sizes="(max-width: 640px) 100vw, 384px" className="object-cover" />
        <span className="absolute bottom-2 start-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">{sub}</span>
      </div>
      <div className="flex items-center gap-3 px-3 pt-2.5 text-ink">
        <Heart size={22} aria-hidden />
        <ChatCircle size={22} aria-hidden />
        <PaperPlaneTilt size={22} aria-hidden />
      </div>
      <div className="px-3 pb-3 pt-1.5">
        {loading ? (
          <div className="grid gap-1.5 pt-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ) : (
          <p className="line-clamp-[10] whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
            <span className="font-semibold">koretbakes</span> {caption || <span className="text-ink-3">Caption appears here after you generate.</span>}
          </p>
        )}
      </div>
    </article>
  );
}

// ------------------------------------------------------------ review queue

type QFilter = "all" | ContentDraft["status"];

function Queue() {
  const run = useDemo((s) => s.run);
  const content = useDemo((s) => s.content);
  const products = useDemo((s) => s.products);
  const now = useNow();
  const [filter, setFilter] = useState<QFilter>("all");
  const [scheduling, setScheduling] = useState<ContentDraft | null>(null);
  const [when, setWhen] = useState("");

  const list = content.filter((c) => filter === "all" || c.status === filter);
  const count = (s: ContentDraft["status"]) => content.filter((c) => c.status === s).length;

  const update = (id: string, fn: (c: ContentDraft) => void) => run((s) => {
    const c = s.content.find((x) => x.id === id);
    if (c) fn(c);
  });
  const approve = (c: ContentDraft) => {
    update(c.id, (x) => void (x.status = "approved"));
    run((s) => logEvent(s, { automation: "content", kind: "action", title: "Content approved by Koret", detail: c.title, minutesSaved: 1 }));
    toast("Approved", c.title);
  };
  const openSchedule = (c: ContentDraft) => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    setWhen(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setScheduling(c);
  };
  const confirmSchedule = () => {
    const c = scheduling;
    if (!c || !when) return;
    const at = new Date(when).toISOString();
    update(c.id, (x) => {
      x.status = "scheduled";
      x.scheduledFor = at;
    });
    run((s) => logEvent(s, { automation: "content", kind: "action", title: `Content scheduled for ${dateTime(at)}`, detail: c.title, minutesSaved: 3 }));
    setScheduling(null);
    toast("Scheduled", `${c.title} · ${dateTime(at)}`);
  };
  const publish = (c: ContentDraft) => {
    update(c.id, (x) => {
      x.status = "published";
      x.scheduledFor = new Date().toISOString();
    });
    const where = c.kind === "whatsapp-broadcast" ? "WhatsApp broadcast list" : c.kind === "menu-copy" ? "website menu" : "Instagram";
    run((s) => logEvent(s, { automation: "content", kind: "action", title: `Published to ${where}`, detail: c.title, minutesSaved: 10 }));
    toast(`Published to ${where}`, c.title);
  };

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Review queue</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">{count("draft")} waiting for approval · {count("scheduled")} scheduled</p>
        </div>
        <Segmented
          size="sm"
          className="flex-wrap"
          value={filter}
          onChange={setFilter}
          options={[{ value: "all", label: "All" }, ...(Object.keys(STATUS) as ContentDraft["status"][]).map((s) => ({ value: s, label: STATUS[s].label }))]}
        />
      </div>
      {list.length === 0 ? (
        <Empty icon={<Sparkle size={26} />} title="Nothing here yet" sub="Generate a caption above and save it for approval." />
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {list.map((c) => {
            const p = products.find((x) => x.id === c.productId);
            return (
              <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
                {p ? <Thumb src={p.image} className="h-16 w-16 rounded-xl" sizes="64px" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-3"><Sparkle size={20} /></span>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-ink">{c.title}</h3>
                    <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                    <Badge>{KIND_LABEL[c.kind]}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] text-ink-2">{c.body}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    Created {ago(c.createdAt, now)}
                    {c.scheduledFor && c.status === "scheduled" && ` · goes out ${dateTime(c.scheduledFor)}`}
                    {c.scheduledFor && c.status === "published" && ` · published ${ago(c.scheduledFor, now)}`}
                    {c.scheduledFor && c.status === "approved" && ` · planned for ${dateTime(c.scheduledFor)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-start gap-2">
                  {c.status === "draft" && <Button size="sm" variant="secondary" onClick={() => approve(c)}><CheckCircle size={14} /> Approve</Button>}
                  {(c.status === "draft" || c.status === "approved") && <Button size="sm" variant="secondary" onClick={() => openSchedule(c)}><CalendarCheck size={14} /> Schedule</Button>}
                  {c.status !== "published" && <Button size="sm" onClick={() => publish(c)}><UploadSimple size={14} /> Publish</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(scheduling)}
        onClose={() => setScheduling(null)}
        title="Schedule post"
        footer={
          <>
            <Button variant="ghost" onClick={() => setScheduling(null)}>Cancel</Button>
            <Button onClick={confirmSchedule} disabled={!when}><CalendarCheck size={16} /> Schedule</Button>
          </>
        }
      >
        {scheduling && (
          <div className="grid gap-3">
            <p className="text-[13px] text-ink-2">{scheduling.title}</p>
            <Field label="Date and time (Lagos)" hint="Best engagement for cake posts: weekdays 7pm to 9pm, Saturdays 10am.">
              {(fid) => <Input id={fid} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} data-autofocus />}
            </Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}
