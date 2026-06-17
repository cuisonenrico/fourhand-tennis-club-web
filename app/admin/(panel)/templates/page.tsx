import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplates } from "@/lib/admin/queries";
import { TemplateEditor } from "@/components/admin/template-editor";

export const metadata: Metadata = { title: "Email templates", robots: { index: false } };

export default async function TemplatesPage() {
  const supabase = createAdminClient();
  const saved = await getTemplates(supabase);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-charcoal">Email templates</h1>
        <p className="text-sm text-charcoal/60">
          Override the subject line or intro paragraph for each transactional email. Leave a field
          blank to use the built-in copy.
        </p>
      </div>
      <TemplateEditor saved={saved} />
    </div>
  );
}
