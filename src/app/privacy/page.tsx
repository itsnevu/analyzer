import type { Metadata } from "next";
import { connection } from "next/server";
import { retentionDays } from "@/lib/usage";
import { ForgetBrowser } from "./ForgetBrowser";

export const metadata: Metadata = { title: "Privacy and research data" };

export default async function PrivacyPage() {
  await connection();
  const days = retentionDays();
  const sections: [string, React.ReactNode][] = [
    [
      "What we record",
      <ul key="w" className="list-disc space-y-1.5 pl-5">
        <li>Every check: the text or link you submit, the result, and when.</li>
        <li>Your IP address, and the network it belongs to (internet provider or organization, and country), looked up in a public registry on our own server.</li>
        <li>Your browser&apos;s full identification string (User-Agent), device type, language, time zone, screen size, the website that linked you here and any campaign tags in the link.</li>
        <li>A random ID stored in your browser and one for each visit, so repeat visits can be counted without knowing your name.</li>
        <li>Your role and organization, only if you choose to tell us.</li>
        <li>Reports and messages you send, with your name and e-mail if you give them, an optional screenshot, and the same technical details.</li>
      </ul>,
    ],
    [
      "Why",
      "To run and protect the service, to improve the detector, and for academic research on how people use a hoax detector. Research is published only as statistics or anonymized data. IP addresses, browser IDs and messages that could identify a person are never published.",
    ],
    [
      "Who can see it",
      "Only the site's administrators. The records are kept on the site's own server; they are not sold, and the site uses no advertising or third-party trackers. When you send a report or a message, the administrators are notified by e-mail and Telegram with your name, e-mail and the start of the message. The site is reached through Cloudflare, which carries the connection.",
    ],
    [
      "How long",
      days
        ? `IP addresses are deleted ${days} days after your visit, and the code derived from them is then scrambled so it cannot be traced back to the address. The network name, country, device type, checked text and result are kept for research. Reports and messages are kept until they have been dealt with and are then deleted on request.`
        : "Records, including IP addresses, are kept for the duration of the research.",
    ],
    [
      "Your choices",
      <div key="c" className="space-y-3">
        <p>
          Don&apos;t paste personal information into the detector. To have your records deleted, write to{" "}
          <a href="mailto:syyhoaxanalyzer@gmail.com" className="underline">syyhoaxanalyzer@gmail.com</a> with the date and time of your checks and the browser ID below.
        </p>
        <ForgetBrowser />
      </div>,
    ],
  ];
  return (
    <section className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="eyebrow">Privacy</p>
        <h1 className="font-display text-4xl font-bold">Privacy and research data</h1>
        <p className="text-sm text-ink-muted">
          This site is also a research project: we study how people use a hoax detector. This page explains what is recorded when you use it.
        </p>
        {sections.map(([title, body]) => (
          <div key={title} className="neu p-5 text-sm leading-relaxed text-ink">
            <h2 className="mb-2 font-semibold">{title}</h2>
            {body}
          </div>
        ))}
        <p className="text-xs text-ink-faint">Last updated October 8, 2026.</p>
      </div>
    </section>
  );
}
