"use client";

import { ArrowCounterClockwise, BookOpen, CheckCircle, Flask, PaperPlaneRight, Plus, ShieldCheck, Trash, UserSwitch } from "@phosphor-icons/react";
import { useState } from "react";
import { PageHead } from "@/components/app/app-shell";
import { Badge, Button, Card, CardHead, Field, Input, Modal, Segmented, Textarea, Toggle, cx } from "@/components/ui";
import { logEvent } from "@/lib/engine";
import { uid } from "@/lib/format";
import { respond, type Reply } from "@/lib/sim/assistant";
import { useDemo } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { AssistantSettings, Conversation, KBEntry } from "@/lib/types";

type Tab = "behaviour" | "knowledge" | "sandbox";

export default function AssistantPage() {
  const [tab, setTab] = useState<Tab>("behaviour");
  const flagged = useDemo((s) => s.conversations.filter((c) => c.review === "flagged").length);
  return (
    <>
      <PageHead
        title="Tia settings"
        sub="Tia answers Instagram, WhatsApp and website chats in Temmie's voice. Change what she knows, what she may promise and when she hands over, then test it in the sandbox before customers see it."
      />
      <Segmented<Tab>
        className="mb-5 max-w-full overflow-x-auto"
        value={tab}
        onChange={setTab}
        options={[
          { value: "behaviour", label: "Behaviour & handoff" },
          { value: "knowledge", label: "Knowledge base" },
          { value: "sandbox", label: "Test sandbox" },
        ]}
      />
      {flagged > 0 && tab !== "sandbox" && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-2.5 text-[13px] text-warn">{flagged} chat{flagged > 1 ? "s" : ""} flagged from the inbox. Add the right answer to the knowledge base so Tia learns it.</p>}
      {tab === "behaviour" && <Behaviour />}
      {tab === "knowledge" && <Knowledge />}
      {tab === "sandbox" && <Sandbox />}
    </>
  );
}

function useSettings() {
  const settings = useDemo((s) => s.assistant);
  const run = useDemo((s) => s.run);
  const update = (fn: (a: AssistantSettings) => void, note?: string) => {
    run((s) => {
      fn(s.assistant);
      if (note) logEvent(s, { automation: "ai-assistant", kind: "action", title: "Tia settings changed", detail: note, minutesSaved: 0 });
    });
  };
  return { settings, update };
}

function Behaviour() {
  const { settings, update } = useSettings();
  const [rule, setRule] = useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHead title="Personality" sub="How Tia sounds" />
        <div className="grid gap-4 p-5">
          <Field label="Assistant name">{(id) => <Input id={id} value={settings.name} onChange={(e) => update((a) => void (a.name = e.target.value))} />}</Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Tone</p>
            <Segmented
              value={settings.tone}
              onChange={(v) => update((a) => void (a.tone = v), `Tone set to ${v}`)}
              options={[
                { value: "warm", label: "Warm" },
                { value: "playful", label: "Playful" },
                { value: "concise", label: "Concise" },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
            <div>
              <p className="text-[13.5px] font-medium text-ink">Say she is an AI assistant</p>
              <p className="text-xs text-ink-3">Recommended. Customers trust it more when it is clear.</p>
            </div>
            <Toggle checked={settings.discloseAI} onChange={(v) => update((a) => void (a.discloseAI = v), v ? "AI disclosure on" : "AI disclosure off")} label="Disclose AI" />
          </div>
          <Field label="Deposit required to book a slot" hint="Tia asks for this share of the total before confirming a date.">
            {(id) => (
              <div className="flex items-center gap-2">
                <Input id={id} type="number" min={0} max={100} step={10} value={settings.depositPct} onChange={(e) => update((a) => void (a.depositPct = Math.max(0, Math.min(100, Number(e.target.value) || 0))))} className="w-28" />
                <span className="text-sm text-ink-3">%</span>
              </div>
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHead title="Rules she always follows" sub="Guardrails on what Tia may promise" />
        <ul className="divide-y divide-line px-5">
          {settings.rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <ShieldCheck size={18} className={r.enabled ? "text-ok" : "text-ink-3"} />
              <span className={cx("flex-1 text-[13.5px]", r.enabled ? "text-ink" : "text-ink-3 line-through")}>{r.text}</span>
              <Toggle checked={r.enabled} onChange={(v) => update((a) => void (a.rules.find((x) => x.id === r.id)!.enabled = v), `Rule ${v ? "on" : "off"}: ${r.text}`)} label={r.text} />
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2 border-t border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const t = rule.trim();
            if (!t) return;
            update((a) => void a.rules.push({ id: uid("r"), text: t, enabled: true }), `New rule: ${t}`);
            setRule("");
            toast("Rule added", t, "ok");
          }}
        >
          <label htmlFor="new-rule" className="sr-only">New rule</label>
          <Input id="new-rule" value={rule} onChange={(e) => setRule(e.target.value)} placeholder="e.g. Never promise same-day delivery to Ajah" />
          <Button type="submit" variant="secondary"><Plus size={15} /> Add</Button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardHead title="When Tia hands over to Temmie" sub="If a message matches, Tia stops, tells the customer Temmie will reply and flags the chat in your inbox" />
        <ul className="grid gap-3 p-5 md:grid-cols-2">
          {settings.handoff.map((h) => (
            <li key={h.id} className="rounded-xl border border-line p-4">
              <div className="flex items-center gap-3">
                <UserSwitch size={18} className={h.enabled ? "text-brand" : "text-ink-3"} />
                <span className="flex-1 text-[13.5px] font-medium text-ink">{h.label}</span>
                <Toggle checked={h.enabled} onChange={(v) => update((a) => void (a.handoff.find((x) => x.id === h.id)!.enabled = v), `Handoff ${v ? "on" : "off"}: ${h.label}`)} label={h.label} />
              </div>
              <div className="mt-3">
                {h.keywords.length ? (
                  <Field label="Trigger words, comma separated">
                    {(id) => <Input id={id} defaultValue={h.keywords.join(", ")} onBlur={(e) => update((a) => void (a.handoff.find((x) => x.id === h.id)!.keywords = e.target.value.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)), `Trigger words updated: ${h.label}`)} />}
                  </Field>
                ) : <p className="text-xs text-ink-3">Triggered by the order total, not by words.</p>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Knowledge() {
  const kb = useDemo((s) => s.kb);
  const run = useDemo((s) => s.run);
  const [edit, setEdit] = useState<KBEntry | null>(null);
  const [q, setQ] = useState("");
  const list = kb.filter((k) => !q || `${k.question} ${k.answer} ${k.keywords.join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  const save = (e: KBEntry) => {
    run((s) => {
      const i = s.kb.findIndex((k) => k.id === e.id);
      if (i >= 0) s.kb[i] = e;
      else s.kb.unshift(e);
      logEvent(s, { automation: "ai-assistant", kind: "action", title: "Knowledge base updated", detail: e.question, minutesSaved: 0 });
    });
    setEdit(null);
    toast("Saved", "Tia will use this answer from now on.", "ok");
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="kb-search" className="sr-only">Search knowledge base</label>
        <Input id="kb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers" className="max-w-xs" />
        <span className="flex-1" />
        <Button onClick={() => setEdit({ id: uid("kb"), question: "", keywords: [], answer: "", approved: true })}><Plus size={15} /> Add answer</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((k) => (
          <Card key={k.id} className="flex flex-col p-4">
            <div className="flex items-start gap-2">
              <BookOpen size={17} className="mt-0.5 shrink-0 text-brand" />
              <p className="flex-1 text-[14px] font-semibold text-ink">{k.question}</p>
              {k.approved ? <Badge tone="ok">Live</Badge> : <Badge tone="warn">Draft</Badge>}
            </div>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-2">{k.answer}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {k.keywords.slice(0, 6).map((w) => <span key={w} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-3">{w}</span>)}
              <span className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => setEdit(k)}>Edit</Button>
              <Button size="sm" variant="ghost" aria-label={`Delete ${k.question}`} onClick={() => { run((s) => void (s.kb = s.kb.filter((x) => x.id !== k.id))); toast("Answer removed", k.question, "info"); }}><Trash size={14} /></Button>
            </div>
          </Card>
        ))}
      </div>
      {edit && <KBEditor entry={edit} onClose={() => setEdit(null)} onSave={save} />}
    </>
  );
}

function KBEditor({ entry, onClose, onSave }: { entry: KBEntry; onClose: () => void; onSave: (e: KBEntry) => void }) {
  const [e, setE] = useState(entry);
  const [kw, setKw] = useState(entry.keywords.join(", "));
  const valid = e.question.trim() && e.answer.trim();
  return (
    <Modal
      open
      onClose={onClose}
      title={entry.question ? "Edit answer" : "New answer"}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onSave({ ...e, keywords: kw.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) })}>Save</Button></>}
    >
      <div className="grid gap-4">
        <Field label="Customer question">{(id) => <Input id={id} value={e.question} onChange={(x) => setE({ ...e, question: x.target.value })} placeholder="Do you deliver to Ibadan?" />}</Field>
        <Field label="Words that should trigger this answer" hint="Comma separated. Pidgin works too.">{(id) => <Input id={id} value={kw} onChange={(x) => setKw(x.target.value)} placeholder="ibadan, outside lagos, interstate" />}</Field>
        <Field label="Tia's answer">{(id) => <Textarea id={id} value={e.answer} onChange={(x) => setE({ ...e, answer: x.target.value })} rows={5} />}</Field>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3 text-[13px]">
          <span className="text-ink">Live for customers</span>
          <Toggle checked={e.approved} onChange={(v) => setE({ ...e, approved: v })} label="Live for customers" />
        </div>
      </div>
    </Modal>
  );
}

const TRIES = [
  "How much is a 10 inch chocolate cake?",
  "Do you have anything without eggs?",
  "abeg how much be cupcakes for 12",
  "I want a discount please",
  "Where is my order TB-1042?",
  "Wedding cake for 200 guests in December",
];

function Sandbox() {
  const st = useDemo((s) => s);
  const blank = (): Conversation => ({ id: "sandbox", channel: "web", name: "Sandbox tester", status: "ai", draft: {}, messages: [], startedAt: new Date().toISOString(), lastAt: new Date().toISOString(), unread: 0 });
  const [conv, setConv] = useState<Conversation>(blank);
  const [text, setText] = useState("");
  const [last, setLast] = useState<Reply | null>(null);

  const ask = (t: string) => {
    const msg = t.trim();
    if (!msg) return;
    const at = new Date().toISOString();
    const withUser: Conversation = { ...conv, messages: [...conv.messages, { id: uid("m"), from: "user", text: msg, at }] };
    const r = respond(withUser, msg, { products: st.products, kb: st.kb, settings: st.assistant, orders: st.orders, courses: st.courses, cohorts: st.cohorts, capacity: st.dailyCapacity, now: Date.parse(at) });
    setLast(r);
    setConv({ ...withUser, draft: r.draft, status: r.handoff ? "handoff" : "ai", messages: [...withUser.messages, { id: uid("m"), from: "ai", text: r.text, at }] });
    setText("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Flask size={18} className="text-brand" />
          <p className="flex-1 text-sm font-semibold text-ink">Test Tia safely</p>
          <Button size="sm" variant="ghost" onClick={() => { setConv(blank()); setLast(null); }}><ArrowCounterClockwise size={14} /> Restart</Button>
        </div>
        <div className="scrollbar-thin flex min-h-[340px] flex-1 flex-col gap-2.5 overflow-y-auto bg-bg/60 p-4" role="log" aria-live="polite">
          {!conv.messages.length && <p className="text-sm text-ink-3">Nothing here touches real orders or customers. Try one of these:</p>}
          {!conv.messages.length && <div className="flex flex-wrap gap-2">{TRIES.map((t) => <button key={t} onClick={() => ask(t)} className="rounded-full border border-brand/30 px-3 py-1.5 text-[12.5px] text-brand hover:bg-brand-soft">{t}</button>)}</div>}
          {conv.messages.map((m) => (
            <p key={m.id} className={cx("max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13.5px]", m.from === "user" ? "self-end bg-brand text-brand-ink" : "self-start bg-surface text-ink shadow-soft")}>{m.text}</p>
          ))}
          {conv.status === "handoff" && <p className="self-center rounded-full bg-warn-soft px-3 py-1 text-xs text-warn">Handed to Temmie · {last?.handoff}</p>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="flex gap-2 border-t border-line p-3">
          <label htmlFor="sandbox-input" className="sr-only">Test message</label>
          <Input id="sandbox-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type like a customer would" />
          <button type="submit" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink" aria-label="Send test message"><PaperPlaneRight size={18} weight="fill" /></button>
        </form>
      </Card>

      <Card>
        <CardHead title="What Tia understood" sub="Updated after each message" />
        {last ? (
          <dl className="grid gap-3 p-5 text-[13px]">
            <div><dt className="text-ink-3">Intent</dt><dd className="mt-0.5 font-mono text-[12.5px] text-ink">{last.intent}</dd></div>
            <div><dt className="text-ink-3">Details captured</dt><dd className="mt-1 flex flex-wrap gap-1.5">{last.extracted.length ? last.extracted.map((x) => <Badge key={x} tone="brand">{x}</Badge>) : <span className="text-ink-3">None yet</span>}</dd></div>
            {last.kbId && <div><dt className="text-ink-3">Answered from</dt><dd className="mt-0.5 text-ink">{st.kb.find((k) => k.id === last.kbId)?.question}</dd></div>}
            {last.handoff && <div><dt className="text-ink-3">Handoff</dt><dd className="mt-0.5 text-brand">{last.handoff}</dd></div>}
            {last.createOrder && <div className="flex items-center gap-1.5 text-ok"><CheckCircle size={16} weight="fill" /> Would create an order and send a deposit link</div>}
            {last.enrollCohortId && <div className="flex items-center gap-1.5 text-ok"><CheckCircle size={16} weight="fill" /> Would reserve a class seat</div>}
            {last.cateringQuote && <div className="flex items-center gap-1.5 text-ok"><CheckCircle size={16} weight="fill" /> Would draft a corporate quote</div>}
            {last.draft.awaiting && <div><dt className="text-ink-3">Next she asks for</dt><dd className="mt-0.5 text-ink">{last.draft.awaiting}</dd></div>}
          </dl>
        ) : <p className="p-5 text-sm text-ink-3">Send a message to see the intent, the details Tia picked out and whether she would hand over.</p>}
      </Card>
    </div>
  );
}
