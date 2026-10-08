"use client";

import { useState, useSyncExternalStore } from "react";
import { getProfile, saveProfile, sendUsage, usageMeta, type Profile } from "@/lib/usage-client";
import { clsx } from "@/lib/clsx";
import { tk } from "@/lib/site-lang";
import { useI18n } from "@/lib/i18n";

const ROLES: [string, string][] = [
  ["journalist", tk("Journalist")], ["fact-checker", tk("Fact-checker")], ["student", tk("Student")], ["teacher", tk("Teacher or lecturer")],
  ["researcher", tk("Researcher")], ["government", tk("Government")], ["community", tk("NGO or community")], ["public", tk("General public")], ["other", tk("Other")],
];

/** Optional, self-reported role for the usage research; asked once per browser. */
export function ResearchCard({ checkId }: { checkId?: number | null }) {
  const { t } = useI18n();
  const saved = useSyncExternalStore(() => () => {}, () => JSON.stringify(getProfile()), () => "null");
  const [done, setDone] = useState<Profile | null>(null);
  const [role, setRole] = useState("");
  const [org, setOrg] = useState("");
  const profile = done ?? (JSON.parse(saved) as Profile | null);
  if (profile) return null;

  function submit() {
    const p = { role, organization: org.trim().slice(0, 120) };
    saveProfile(p);
    sendUsage({ kind: "profile", checkId, meta: usageMeta() });
    setDone(p);
  }

  return (
    <div className="border-t border-hairline px-6 py-5 sm:px-8">
      <h4 className="eyebrow">{t("Help our research (optional)")}</h4>
      <p className="mt-1 text-xs text-ink-faint">{t("We study who uses a hoax checker. Who are you checking this as?")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ROLES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRole(key)}
            className={clsx("rounded-full border px-3 py-1 text-xs", role === key ? "border-ink bg-ink text-surface-raised" : "border-hairline text-ink-muted hover:border-ink")}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {role && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            maxLength={120}
            placeholder={t("Organization, e.g. newsroom or campus (optional)")}
            className="min-w-0 flex-1 rounded-full border border-hairline bg-surface-raised px-4 py-2 text-xs outline-none focus:border-ink"
          />
          <button type="button" onClick={submit} className="btn-primary px-4 py-2 text-xs">
            {t("Save")}
          </button>
        </div>
      )}
    </div>
  );
}
