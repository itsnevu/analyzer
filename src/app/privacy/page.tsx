import type { Metadata } from "next";
import { connection } from "next/server";
import { rich } from "@/components/ui/Rich";
import { getSiteT } from "@/lib/site-lang-server";
import { retentionDays } from "@/lib/usage";
import { ForgetBrowser } from "./ForgetBrowser";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteT();
  return { title: t("Privacy and research data") };
}

export default async function PrivacyPage() {
  await connection();
  const { t } = await getSiteT();
  const days = retentionDays();
  const sections: [string, React.ReactNode][] = [
    [
      t("What we record"),
      <ul key="w" className="list-disc space-y-1.5 pl-5">
        <li>{t("Every check: the text or link you submit, the result, and when.")}</li>
        <li>{t("Your IP address, and the network it belongs to (internet provider or organization, and country), looked up in a public registry on our own server.")}</li>
        <li>{t("Your browser's full identification string (User-Agent), device type, language, time zone, screen size, the website that linked you here and any campaign tags in the link.")}</li>
        <li>{t("A random ID stored in your browser and one for each visit, so repeat visits can be counted without knowing your name.")}</li>
        <li>{t("Your role and organization, only if you choose to tell us.")}</li>
        <li>{t("Reports and messages you send, with your name and e-mail if you give them, an optional screenshot, and the same technical details.")}</li>
      </ul>,
    ],
    [
      t("Why"),
      t("To run and protect the service, to improve the detector, and for academic research on how people use a hoax detector. Research is published only as statistics or anonymized data. IP addresses, browser IDs and messages that could identify a person are never published."),
    ],
    [
      t("Who can see it"),
      t("Only the site's administrators. The records are kept on the site's own server; they are not sold, and the site uses no advertising or third-party trackers. When you send a report or a message, the administrators are notified by e-mail and Telegram with your name, e-mail and the start of the message. The site is reached through Cloudflare, which carries the connection."),
    ],
    [
      t("How long"),
      days
        ? t("IP addresses are deleted {days} days after your visit, and the code derived from them is then scrambled so it cannot be traced back to the address. The network name, country, device type, checked text and result are kept for research. Reports and messages are kept until they have been dealt with and are then deleted on request.", { days })
        : t("Records, including IP addresses, are kept for the duration of the research."),
    ],
    [
      t("Your choices"),
      <div key="c" className="space-y-3">
        <p>
          {rich(t("Don't paste personal information into the detector. To have your records deleted, write to <mail>syyhoaxanalyzer@gmail.com</mail> with the date and time of your checks and the browser ID below."), {
            mail: (s) => (
              <a href="mailto:syyhoaxanalyzer@gmail.com" className="underline">
                {s}
              </a>
            ),
          })}
        </p>
        <ForgetBrowser />
      </div>,
    ],
  ];
  return (
    <section className="container-page py-12">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="eyebrow">{t("Privacy")}</p>
        <h1 className="font-display text-4xl font-bold">{t("Privacy and research data")}</h1>
        <p className="text-sm text-ink-muted">
          {t("This site is also a research project: we study how people use a hoax detector. This page explains what is recorded when you use it.")}
        </p>
        {sections.map(([title, body]) => (
          <div key={title} className="neu p-5 text-sm leading-relaxed text-ink">
            <h2 className="mb-2 font-semibold">{title}</h2>
            {body}
          </div>
        ))}
        <p className="text-xs text-ink-faint">{t("Last updated October 8, 2026.")}</p>
      </div>
    </section>
  );
}
