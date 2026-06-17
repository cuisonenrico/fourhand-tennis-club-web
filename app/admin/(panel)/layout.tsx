import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return (
    <>
      <AdminHeader email={user.email ?? undefined} />
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
