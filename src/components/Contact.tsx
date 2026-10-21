/* =========================================================
   CONTACT — a small "new message" window. Send opens the
   visitor's own email app with the subject + message filled in
   (a mailto: link, encodeURIComponent so spaces stay spaces).
   Nothing is sent from this site.
   ========================================================= */
import { useState, type FormEvent } from 'react';
import { HOME } from '../data/home';
import '../styles/contact-send.css';

export function Contact() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const s = subject.trim() || 'Hello Daniel';
    const b = body.trim();
    location.href = `mailto:${HOME.email}?subject=${encodeURIComponent(s)}${b ? '&body=' + encodeURIComponent(b) : ''}`;
  };

  return (
    <section className="sec" id="contact" aria-labelledby="contactTitle">
      <h2 className="h" id="contactTitle">Contact</h2>
      <p className="sec__text">Have an idea or an opportunity? Say hello.</p>
      <form className="mail" id="mailForm" action={`mailto:${HOME.email}`} method="get" encType="text/plain" onSubmit={send}>
        <div className="mail__bar" aria-hidden="true"><i></i><i></i><i></i><span>New message</span></div>
        <div className="mail__row">
          <span className="mail__label" id="mailToLabel">To</span>
          <a className="mail__to" href={`mailto:${HOME.email}`} aria-labelledby="mailToLabel mailToAddr" id="mailToAddr">{HOME.email}</a>
        </div>
        <label className="mail__row">
          <span className="mail__label">Subject</span>
          <input className="mail__input" id="mailSubject" name="subject" type="text" autoComplete="off" placeholder="Hello Daniel" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="mail__body">
          <span className="sr">Message</span>
          <textarea className="mail__input" id="mailBody" name="body" rows={4} placeholder="Write something…" value={body} onChange={(e) => setBody(e.target.value)}></textarea>
        </label>
        <div className="mail__foot">
          <span className="mail__note">Opens your email app.</span>
          <button className="mail__send mail__send--animated" type="submit">
            <span>Send</span>
            <span className="mail__send-arrow" aria-hidden="true">
              <span className="mail__send-trail" />
              <svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </span>
          </button>
        </div>
      </form>
    </section>
  );
}
