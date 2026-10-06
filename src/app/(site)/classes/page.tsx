"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Certificate, ChalkboardTeacher, UsersThree } from "@phosphor-icons/react";
import { Reveal } from "@/components/site/site-shell";
import { Eyebrow, MODE_LABEL, nextCohort, prettyDay } from "@/components/site/site-bits";
import { cx } from "@/components/ui";
import { naira } from "@/lib/engine";
import { useNow } from "@/lib/hooks";
import { dayKey } from "@/lib/sim/pricing";
import { useDemo } from "@/lib/store";
import type { Cohort, Course } from "@/lib/types";

export default function ClassesPage() {
  const courses = useDemo((s) => s.courses);
  const cohorts = useDemo((s) => s.cohorts);
  const now = useNow(60000);
  const [feature, ...rest] = courses;

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-12 sm:px-6 sm:pt-16 md:grid-cols-[1fr_1.05fr]">
        <div>
          <Eyebrow>Koretbakes Academy</Eyebrow>
          <h1 className="mt-3 font-display text-[2.4rem] leading-[1.05] text-ink sm:text-6xl">
            Learn the cakes <span className="italic text-brand">Lagos orders</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2 sm:text-base">Small hands-on classes in our Ikeja studio, from your first sponge to pricing and selling on Instagram.</p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <p className="font-display text-4xl text-ink">200+</p>
              <p className="text-[13px] text-ink-2">students trained</p>
            </div>
            <div>
              <p className="font-display text-4xl text-ink">12</p>
              <p className="text-[13px] text-ink-2">seats per class, max</p>
            </div>
            <div>
              <p className="font-display text-4xl text-ink">{courses.length}</p>
              <p className="text-[13px] text-ink-2">courses this term</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-[1.3fr_1fr] gap-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[1.8rem] bg-surface-2">
            <Image src="/img/class-group.jpg" alt="Students at a baking class" fill priority sizes="(min-width: 768px) 30vw, 55vw" className="object-cover" />
          </div>
          <div className="mt-12 flex flex-col gap-3">
            <div className="relative aspect-square overflow-hidden rounded-[1.6rem] bg-surface-2">
              <Image src="/img/class-kneading.jpg" alt="Hands kneading dough" fill sizes="(min-width: 768px) 22vw, 40vw" className="object-cover" />
            </div>
            <div className="rounded-[1.6rem] bg-brand p-4 text-brand-ink">
              <Certificate size={22} aria-hidden />
              <p className="mt-2 text-[13px] leading-snug">Certificate on completion, plus our costing sheet</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="courses-h">
        <Reveal className="flex items-end justify-between gap-4 border-t border-line pt-10">
          <h2 id="courses-h" className="font-display text-3xl text-ink sm:text-4xl">Courses</h2>
          <p className="hidden text-sm text-ink-3 sm:block">50% deposit holds your seat</p>
        </Reveal>

        {feature && <CourseCard course={feature} next={nextCohort(cohorts, feature.id, now)} wide />}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((c, i) => (
            <Reveal key={c.id} delay={(i % 3) * 0.05}>
              <CourseCard course={c} next={nextCohort(cohorts, c.id, now)} />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

function CourseCard({ course: c, next, wide }: { course: Course; next?: Cohort; wide?: boolean }) {
  const left = next ? next.seats - next.studentIds.length : 0;
  const full = !next || left <= 0;
  return (
    <Link href={`/classes/${c.slug}`} className={cx("group flex h-full overflow-hidden rounded-[1.6rem] border border-line bg-surface transition-colors hover:border-line-strong", wide ? "mt-8 flex-col md:flex-row" : "flex-col")}>
      <span className={cx("relative block shrink-0 overflow-hidden bg-surface-2", wide ? "aspect-[16/10] md:aspect-auto md:w-[55%]" : "aspect-[16/10]")}>
        <Image src={c.image} alt="" fill sizes={wide ? "(min-width: 768px) 55vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]" />
        <span className="absolute start-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11.5px] font-semibold text-ink backdrop-blur">{c.level}</span>
      </span>
      <span className={cx("flex flex-1 flex-col", wide ? "p-6 sm:p-9" : "p-5")}>
        <span className={cx("font-display leading-tight text-ink", wide ? "text-3xl sm:text-4xl" : "text-xl")}>{c.title}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
          <span className="inline-flex items-center gap-1">
            <ChalkboardTeacher size={14} aria-hidden /> {c.days} {c.days === 1 ? "day" : c.mode === "online" ? "days, self-paced" : "days"}
          </span>
          <span>{MODE_LABEL[c.mode]}</span>
        </span>
        {wide && <span className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">{c.outline.join(". ")}.</span>}
        <span className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span>
            <span className="tnum block font-display text-2xl text-ink">{naira(c.priceNGN)}</span>
            <span className={cx("mt-0.5 inline-flex items-center gap-1 text-[12.5px]", full ? "text-bad" : left <= 3 ? "text-warn" : "text-ink-3")}>
              <UsersThree size={13} aria-hidden />
              {full || !next ? "Fully booked" : `${prettyDay(dayKey(next.startDate))} · ${left} seat${left === 1 ? "" : "s"} left`}
            </span>
          </span>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink transition-colors group-hover:bg-brand group-hover:text-brand-ink" aria-hidden>
            <ArrowRight size={16} />
          </span>
        </span>
      </span>
    </Link>
  );
}
