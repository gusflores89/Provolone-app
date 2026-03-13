import { updateZoneVendorAssignmentSubmitAction } from "@/app/admin/actions";

type VendorOption = {
  id: string;
  vendorCode: string;
  fullName: string;
};

export function ZoneAssignmentForm({
  zoneId,
  currentVendorId,
  vendors,
}: {
  zoneId: string;
  currentVendorId: string;
  vendors: VendorOption[];
}) {
  return (
    <form action={updateZoneVendorAssignmentSubmitAction} className="space-y-2">
      <input type="hidden" name="zoneId" value={zoneId} />

      <div className="flex flex-col gap-2 xl:flex-row">
        <select
          name="vendorId"
          defaultValue={currentVendorId}
          className="min-w-[170px] rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 outline-none"
        >
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.vendorCode} - {vendor.fullName}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}
