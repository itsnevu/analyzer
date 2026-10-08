import type { Metadata } from "next";
import { ExtractTool } from "@/components/admin/ExtractTool";
import { getAdminT } from "@/lib/admin-lang-server";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Extract from a page") };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** `?text=` prefills the box (the "needs attention" queue and the reports inbox link here); nothing runs until the button is pressed. */
export default async function ExtractPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const { t } = await getAdminT();
  const initialText = one((await searchParams).text).slice(0, 20_000);
  return (
    <div className="space-y-4">
      <AdminPageHeader
        className="mb-0"
        title={t("Extract from a page")}
        description={t("Paste a fact-check link or a forwarded message. The form below is filled in for you to check, then save it as an article.")}
      />
      <ExtractTool initialText={initialText} />
    </div>
  );
}
