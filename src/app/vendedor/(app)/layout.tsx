import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { VendorBottomNav } from "@/components/vendor/vendor-bottom-nav";
import { getVendorSession } from "@/lib/vendor-session";

export default async function VendorLayout({ children }: { children: ReactNode }) {
  const session = await getVendorSession();

  if (!session) {
    redirect("/vendedor/ingresar");
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
        <div className="flex-1">{children}</div>
      </div>
      <VendorBottomNav />
    </div>
  );
}
