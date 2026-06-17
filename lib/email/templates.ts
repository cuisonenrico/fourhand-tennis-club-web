import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailTemplate } from "@/lib/supabase/types";

export interface TemplateCopy { subject: string; intro: string | null }

export function mergeTemplate(row: EmailTemplate | null, fallback: TemplateCopy): TemplateCopy {
  if (!row) return fallback;
  return { subject: row.subject || fallback.subject, intro: row.intro ?? fallback.intro };
}

export async function resolveTemplate(
  supabase: SupabaseClient, type: string, fallback: TemplateCopy,
): Promise<TemplateCopy> {
  const { data } = await supabase.from("email_templates").select("*").eq("type", type).maybeSingle();
  return mergeTemplate((data as EmailTemplate | null) ?? null, fallback);
}
