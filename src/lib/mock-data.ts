export type VisitStatus =
  | "Pendiente"
  | "Visitado con pedido"
  | "Visitado sin pedido"
  | "Reprogramado"
  | "No visitado";

export type VisitCard = {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  zone: string;
  phone?: string;
  status: VisitStatus;
  order: number;
};

export const vendorProfile = {
  name: "Juan Perez",
  code: "V012",
  adminPhone: "+54 9 351 555 0000",
};

export const todayVisits: VisitCard[] = [
  {
    id: "visit-1",
    customerId: "customer-1",
    customerName: "Almacen Rivadavia",
    address: "Av. Colon 1234",
    zone: "Zona 4 - Noreste",
    phone: "3511234567",
    status: "Pendiente",
    order: 1,
  },
  {
    id: "visit-2",
    customerId: "customer-2",
    customerName: "Despensa Mario",
    address: "Dean Funes 890",
    zone: "Zona 4 - Noreste",
    phone: "3512223344",
    status: "Pendiente",
    order: 2,
  },
  {
    id: "visit-3",
    customerId: "customer-3",
    customerName: "Kiosco Luz",
    address: "Santa Rosa 522",
    zone: "Zona 4 - Noreste",
    status: "Reprogramado",
    order: 3,
  },
  {
    id: "visit-4",
    customerId: "customer-4",
    customerName: "Autoservicio Belgrano",
    address: "Belgrano 1881",
    zone: "Zona 4 - Noreste",
    phone: "3519876543",
    status: "Visitado con pedido",
    order: 4,
  },
];

export const customerDetails = {
  "customer-1": {
    name: "Almacen Rivadavia",
    zone: "Zona 4 - Noreste",
    address: "Av. Colon 1234, Cordoba",
    phone: "3511234567",
    notes: "Cliente habitual. Prefiere visita por la manana.",
    mapsUrl: "https://maps.google.com/?q=Av.+Colon+1234+Cordoba",
  },
  "customer-2": {
    name: "Despensa Mario",
    zone: "Zona 4 - Noreste",
    address: "Dean Funes 890, Cordoba",
    phone: "3512223344",
    notes: "Preguntar por promo de hormas.",
    mapsUrl: "https://maps.google.com/?q=Dean+Funes+890+Cordoba",
  },
  "customer-3": {
    name: "Kiosco Luz",
    zone: "Zona 4 - Noreste",
    address: "Santa Rosa 522, Cordoba",
    phone: "",
    notes: "Local pequeno. Suele pedir rapido.",
    mapsUrl: "https://maps.google.com/?q=Santa+Rosa+522+Cordoba",
  },
  "customer-4": {
    name: "Autoservicio Belgrano",
    zone: "Zona 4 - Noreste",
    address: "Belgrano 1881, Cordoba",
    phone: "3519876543",
    notes: "Cliente grande. Revisar stock de quesos.",
    mapsUrl: "https://maps.google.com/?q=Belgrano+1881+Cordoba",
  },
} as const;

export const adminDashboard = {
  kpis: [
    { label: "Clientes activos", value: "5.579" },
    { label: "Zonas activas", value: "21" },
    { label: "Vendedores activos", value: "20" },
    { label: "Visitas de hoy", value: "1.116" },
  ],
  alerts: [
    "V020 supera el objetivo diario sugerido.",
    "Zona 21 requiere revision por carga alta.",
    "La ultima sincronizacion tuvo 2 advertencias.",
  ],
};

export const customersTable = [
  ["Almacen Rivadavia", "Z04", "V012", "7 dias", "Activo"],
  ["Despensa Mario", "Z04", "V012", "7 dias", "Activo"],
  ["Kiosco Luz", "Z04", "V012", "7 dias", "Activo"],
];

export const zonesTable = [
  ["Z01", "Zona 1 - Norte", "V001", "178", "OK"],
  ["Z04", "Zona 4 - Noreste", "V012", "178", "OK"],
  ["Z21", "Fuera de Circunvalacion", "V020", "990", "Sobrecarga"],
];

export const vendorsTable = [
  ["V001", "Ana Lopez", "1", "178", "Activo"],
  ["V012", "Juan Perez", "1", "178", "Activo"],
  ["V020", "Pedro Gomez", "1", "990", "Alerta"],
];

export const weeklyPlanTable = [
  ["V001", "36", "35", "34", "37", "36", "178", "OK"],
  ["V012", "36", "35", "34", "37", "36", "178", "OK"],
  ["V020", "56", "55", "54", "57", "56", "278", "Sobrecarga"],
];

export const visitsTable = [
  ["Almacen Rivadavia", "V012", "10/03", "Con pedido", "Todo ok"],
  ["Kiosco Luz", "V012", "10/03", "Reprogramado", "Pasa el jueves"],
  ["Despensa Mario", "V012", "10/03", "No visitado", "Local cerrado"],
];

export const syncRunsTable = [
  ["2026-03-10 08:00", "OK", "12", "34", "0"],
  ["2026-03-09 18:10", "Warning", "0", "5", "2"],
];

