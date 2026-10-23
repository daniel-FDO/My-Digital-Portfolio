/* =========================================================
   SKILLS & TOOLS — the groups I use on the left (Design and AI
   tools in a middle column on wide screens); "Currently
   learning" and "Learning next" (groups with `learning` in
   home.ts) on the right. Brand marks come from skill-icons.ts;
   OWN_ICONS are drawn here.
   ========================================================= */
import type { ReactElement } from "react";
import { HOME } from "../data/home";
import { SKILL_ICONS } from "../data/skill-icons";
import type { SkillGroup as Group } from "../types";

const OWN_ICONS: Record<string, ReactElement> = {
  // Official brand asset: https://antigravity.google/press
  Antigravity: (
    <img src="/icons/antigravity.svg" width="15" height="15" alt="" />
  ),
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
  uiux: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M1.5 5.5h13M4 8.2h3.5M4 10.6h2.2" />
      <path d="m9.4 8 3.2 1.2-1.4.5-.5 1.4z" fill="currentColor" />
    </svg>
  ),
  motion: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 12.5C4.5 12.5 5 3.5 9 3.5c2.4 0 3.2 2.3 5.5 2.3" />
      <circle cx="9" cy="3.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M1.5 14.5h13" opacity="0.45" />
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
    <div
      className={
        g.learning ? `learn__group learn__group--${g.learning}` : undefined
      }
    >
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

export function Skills() {
  return (
    <section className="sec" id="skills" aria-labelledby="skillsTitle">
      <h2 className="h" id="skillsTitle">
        Tech stack
      </h2>
      {/* Left: the skills I use. Right: what I'm learning now / next. */}
      <div className="skills">
        <div className="stack" id="skillGroups">
          <div className="stack__col">
            {HOME.skills
              .filter((g) => !g.learning && !g.column)
              .map((g) => (
                <SkillGroup g={g} key={g.group} />
              ))}
          </div>
          <div className="stack__col">
            {HOME.skills
              .filter((g) => !g.learning && g.column === "middle")
              .map((g) => (
                <SkillGroup g={g} key={g.group} />
              ))}
          </div>
        </div>
        <div className="learn" id="learnGroups">
          {HOME.skills
            .filter((g) => g.learning)
            .map((g) => (
              <SkillGroup g={g} key={g.group} />
            ))}
        </div>
      </div>
    </section>
  );
}
