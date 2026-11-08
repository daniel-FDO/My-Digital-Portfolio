/* =========================================================
   SKILLS & TOOLS — the groups from home.ts, in two columns on
   wide screens (`column: 'middle'` groups in the second).
   Brand marks come from skill-icons.ts; OWN_ICONS are drawn here.
   ========================================================= */
import { useEffect, useRef, type ReactElement } from "react";
import { HOME } from "../data/home";
import { SKILL_ICONS } from "../data/skill-icons";
import { calm } from "../lib/motion";
import { onPreloaderDone } from "../lib/preloader";
import type { SkillGroup as Group } from "../types";

const OWN_ICONS: Record<string, ReactElement> = {
  // Official brand asset: https://antigravity.google/press
  Antigravity: (
    <img src="/icons/antigravity.svg" width="15" height="15" alt="" />
  ),
  // Official favicon: https://stitch.withgoogle.com
  stitch: <img src="/icons/stitch.png" width="15" height="15" alt="" />,
  // Lovable's brand mark, via Lobe Icons (keeps its gradient)
  lovable: <img src="/icons/lovable.svg" width="15" height="15" alt="" />,
  ts: (
    <svg viewBox="0 0 16 16">
      <rect width="16" height="16" rx="3" fill="#3178c6" />
      <text
        x="14.6"
        y="14"
        textAnchor="end"
        fill="#fff"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="7.4"
        letterSpacing="-0.3"
      >
        TS
      </text>
    </svg>
  ),
  js: (
    <svg viewBox="0 0 16 16">
      <rect width="16" height="16" rx="3" fill="#f7df1e" />
      <text
        x="14.6"
        y="14"
        textAnchor="end"
        fill="#1b1b1b"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="7.4"
        letterSpacing="-0.3"
      >
        JS
      </text>
    </svg>
  ),
  responsive: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 10H2a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h8.5a1 1 0 0 1 1 1V5" />
      <path d="M4.5 13H8M6.2 10v3" />
      <rect x="11" y="6.5" width="4" height="7" rx="0.9" />
      <path d="M12.6 12h.8" />
    </svg>
  ),
};

function iconFor(key: string): ReactElement | null {
  if (OWN_ICONS[key]) return OWN_ICONS[key];
  const b = SKILL_ICONS[key];
  return b ? (
    <svg viewBox="0 0 24 24">
      <path fill={b[0] || "currentColor"} d={b[1]} />
    </svg>
  ) : null;
}

function SkillIcons({ keys, abbr }: { keys: string; abbr: string }) {
  const svgs = String(keys || "")
    .split(" ")
    .map(iconFor)
    .filter((s): s is ReactElement => !!s);
  if (!svgs.length)
    return (
      <span className="chip__i" aria-hidden="true">
        {abbr}
      </span>
    );
  return (
    <>
      {svgs.map((s, i) => (
        <span className="chip__icon" aria-hidden="true" key={i}>
          {s}
        </span>
      ))}
    </>
  );
}

function SkillGroup({ g }: { g: Group }) {
  return (
    <div>
      <h3 className="stack__label">{g.group}</h3>
      <ul className="chips">
        {g.items.map(([name, abbr, icon]) => (
          <li className="chip" key={name}>
            <SkillIcons keys={icon} abbr={abbr} />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* The chips pop in one after another, once, when the section is reached.
   Nothing is hidden by CSS, so they stay readable if this never runs. */
function useChipEntrance(section: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = section.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const running: Animation[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (calm()) return;
        el.querySelectorAll(".chips").forEach((list) =>
          [...list.children].forEach((chip, i) =>
            running.push(
              chip.animate(
                [
                  { opacity: 0, transform: "translateY(8px) scale(0.92)" },
                  { opacity: 1, transform: "none" },
                ],
                {
                  duration: 420,
                  delay: 60 + i * 45,
                  easing: "cubic-bezier(.22,1,.36,1)",
                  fill: "backwards",
                },
              ),
            ),
          ),
        );
      },
      { threshold: 0.08 },
    );
    const stopWaiting = onPreloaderDone(() => observer.observe(el));
    return () => {
      stopWaiting();
      observer.disconnect();
      running.forEach((a) => a.cancel());
    };
  }, [section]);
}

export function Skills() {
  const sectionRef = useRef<HTMLElement>(null);
  useChipEntrance(sectionRef);
  return (
    <section ref={sectionRef} className="sec" id="skills" aria-labelledby="skillsTitle" data-xray="skills">
      <h2 className="h" id="skillsTitle">
        Tech stack
      </h2>
      <div className="skills">
        <div className="stack" id="skillGroups">
          <div className="stack__col">
            {HOME.skills
              .filter((g) => !g.column)
              .map((g) => (
                <SkillGroup g={g} key={g.group} />
              ))}
          </div>
          <div className="stack__col">
            {HOME.skills
              .filter((g) => g.column === "middle")
              .map((g) => (
                <SkillGroup g={g} key={g.group} />
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
