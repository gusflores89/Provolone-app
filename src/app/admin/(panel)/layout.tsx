import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <AdminSidebar />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</div>
    </div>
  );
}
