/* QUESTIONS — the things people ask. Every answer is taken from
   what the site already says (about.ts, education.ts, home.ts). */
export function Faq() {
  return (
    <section className="sec" id="faq" aria-labelledby="faqTitle">
      <h2 className="h" id="faqTitle">Questions</h2>
      <div className="faq">
        <details className="faq__item">
          <summary>Can I get in touch about an opportunity?</summary>
          <p><b>Yes, email me.</b> I’m at college until summer 2027. After that I’m looking at university or an apprenticeship.</p>
        </details>
        <details className="faq__item">
          <summary>What are you studying?</summary>
          <p><b>A T-Level in Digital Software Development</b> at EKC Canterbury College. I’m in my second year.</p>
        </details>
        <details className="faq__item">
          <summary>What do you build with?</summary>
          <p><b>Mostly HTML, CSS, Python and Flask.</b> Right now I’m learning React, TypeScript and more JavaScript.</p>
        </details>
      </div>
    </section>
  );
}
