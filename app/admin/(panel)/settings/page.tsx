import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessSettings } from "@/lib/admin/queries";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const supabase = createAdminClient();
  const settings = await getBusinessSettings(supabase);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-charcoal">Settings</h1>
        <p className="text-sm text-charcoal/60">
          Manage club branding, contact details, operating hours, and booking policy.
        </p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
