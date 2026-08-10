import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BASE = Date.parse('2026-08-03T12:00:00');
const d = (offsetDays: number) => new Date(BASE + offsetDays * 86_400_000);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}
const pick = <T>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pad = (n: number, w = 5) => String(n).padStart(w, '0');

const MARCAS = ['Volvo', 'Scania', 'Freightliner', 'International', 'Kenworth', 'Mack'];
const MODELOS: Record<string, string[]> = {
  Volvo: ['FH 460', 'FH 500'], Scania: ['R450', 'R500'], Freightliner: ['Cascadia'],
  International: ['ProStar'], Kenworth: ['T680'], Mack: ['Anthem'],
};
const NOMBRES = ['Julio Grimaldo', 'Jose Palomino', 'Ronald Saavedra', 'Rafael Cristino', 'Jimy Obregón', 'Marco Antúnez', 'Pedro Ccahua', 'Elmer Ríos', 'David Ramos', 'Walter Ñahui', 'César Huamán', 'Óscar Ledesma', 'Aldo Ventura', 'Manuel Torres', 'Iván Quiroz'];
const CLIENTES = ['ULOG', 'LESCHACO', 'INTERLOG', 'DPA', 'RANSA', 'NEPTUNIA', 'TRAMARSA', 'CONTRANS', 'AUSA'];
const PUERTOS = ['DPWC', 'APM', 'TP Callao'];
const DESTINOS = ['Cercado de Lima', 'Lurín', 'Pta. Hermosa', 'Ate', 'Callao', 'Chilca'];
const DEVOL = ['MEDLOG', 'DPW GT1', 'CONSTRANS', 'NEPTUNIA', 'RANSA'];
const TIENDAS = ['Neumáticos Perú', 'Lima Llantas', 'Repuestos DP', 'Autopartes Lima'];
const LLANTAS = ['Michelin', 'Bridgestone', 'Goodyear', 'Pirelli', 'Continental'];
const POS = ['Delantero izq. (P1)', 'Delantero der. (P1)', 'Tracción int. izq. (P2)', 'Tracción int. der. (P2)', 'Tracción ext. izq. (P3)', 'Tracción ext. der. (P3)'];
const CAT = ['A-IIIC', 'A-IIIB', 'A-IIIA'];
const DOC = ['Licencia de conducir', 'Certificado MTC', 'Examen médico', 'SCTR'];
const REP = ['Pastillas de freno', 'Filtro de aceite', 'Filtro de aire', 'Kit de embrague', 'Batería 12V', 'Amortiguador', 'Bomba de agua', 'Alternador', 'Radiador', 'Muelle trasero'];
const REPCAT = ['Frenos', 'Filtros', 'Transmisión', 'Eléctrico', 'Motor', 'Suspensión'];
const CALID = ['Original', 'Alternativo', 'Remanufacturado'];
const TIPMANT = ['Preventivo', 'Correctivo', 'Predictivo'];
const MANTDESC = ['Mantenimiento programado: aceite y filtros', 'Cambio de pastillas y discos de freno', 'Reparación de embrague', 'Ajuste de eje trasero', 'Cambio de amortiguadores', 'Diagnóstico eléctrico y alternador'];
const CARGOADM = ['Coordinadora de operaciones', 'Asistente administrativo', 'Contador', 'Jefe de flota', 'Tesorería'];
const genPlaca = (r: () => number) => { const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'.split(''); return `${pick(r, L)}${pick(r, L)}${pick(r, L)}-${int(r, 100, 999)}`; };

// Tarifario de bonificación al chofer (del Excel BONOS): [distrito, GRAL, IMO, REEFER]
const TARIFAS: [string, number, number, number][] = [
  ['CALLAO', 80, 130, 110], ['BELLAVISTA', 80, 130, 110], ['CARMEN DE LA LEGUA', 80, 130, 110], ['LA PERLA', 80, 130, 110],
  ['SAN MIGUEL', 80, 130, 110], ['VENTANILLA', 80, 140, 110], ['PTE PIEDRA', 90, 150, 120], ['COMAS', 90, 150, 120],
  ['CERCADO DE LIMA', 90, 150, 120], ['SMP', 90, 150, 120], ['LOS OLIVOS', 90, 150, 120], ['INDEPENDENCIA', 90, 150, 120],
  ['RIMAC', 90, 150, 120], ['EL AGUSTINO', 90, 150, 120], ['BREÑA', 90, 150, 120], ['LA VICTORIA', 90, 150, 120],
  ['SJL', 90, 150, 120], ['SAN LUIS', 90, 150, 120], ['SANTA ANITA', 90, 150, 120], ['VITARTE', 90, 160, 120],
  ['SANTA CLARA', 90, 160, 120], ['HUACHIPA', 100, 160, 130], ['VES', 100, 170, 130], ['LURIGANCHO CARAPONGO', 100, 170, 130],
  ['CHORRILLOS', 100, 170, 130], ['VMT', 100, 170, 130], ['SJM', 100, 170, 130], ['ANCON', 100, 170, 130],
  ['CHACLACAYO', 100, 170, 130], ['CARABAYLLO', 100, 170, 130], ['LURIN', 110, 190, 140], ['PUNTA HERMOSA', 110, 190, 140],
  ['CHOSICA', 110, 190, 140], ['SAN ANTONIO', 110, 190, 140], ['CHILCA', 140, 0, 170], ['CAÑETE', 170, 0, 200],
  ['CHINCHA', 200, 0, 230], ['PISCO', 240, 0, 270], ['ICA', 270, 0, 300], ['HUAURA', 170, 0, 200],
  ['BARRANCA SUPE', 180, 0, 210], ['CASMA', 280, 0, 310], ['CHIMBOTE', 330, 0, 0], ['TRUJILLO', 420, 0, 0],
  ['TACNA', 600, 0, 0], ['CHANCAY', 120, 0, 0],
];
const DISTRITOS = ['CALLAO', 'CERCADO DE LIMA', 'LURIN', 'PUNTA HERMOSA', 'CHORRILLOS', 'SJL', 'VENTANILLA', 'CHILCA', 'ICA', 'TRUJILLO'];
const normD = (s: string) => s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').trim().toUpperCase();
function tarifaMonto(destino: string, tipo: string) {
  const h = TARIFAS.find((t) => normD(t[0]) === normD(destino));
  if (!h) return 0;
  const c = normD(tipo);
  if (c.startsWith('IMO')) return h[2];
  if (c.startsWith('REEF')) return h[3];
  return h[1];
}

async function seedSede(sedeId: string, salt: number) {
  // Catálogos administrables por sede
  await prisma.tipoOperacion.createMany({ data: [
    { sedeId, nombre: 'IMPO' },
    { sedeId, nombre: 'EXPO' },
    { sedeId, nombre: 'Carga suelta' },
  ] });
  const rucDe: Record<string, string> = Object.fromEntries(CLIENTES.map((c, i) => [c, '20' + String(600000000 + (i + salt) * 137).slice(0, 9)]));
  await prisma.cliente.createMany({ data: CLIENTES.map((c) => ({ sedeId, nombre: c, ruc: rucDe[c] })) });
  const puertos = Array.from(new Set([...PUERTOS, ...DEVOL]));
  await prisma.puerto.createMany({ data: puertos.map((n) => ({ sedeId, nombre: n })) });
  await prisma.comision.createMany({ data: TARIFAS.map(([destino, gral, imo, reefer]) => ({ sedeId, destino, gral, imo, reefer })) });

  const tractos: string[] = [];
  const carretas: string[] = [];
  const rv = rng(101 + salt);

  // Vehículos (~20)
  for (let i = 0; i < 20; i++) {
    const tracto = rv() > 0.35;
    const marca = pick(rv, MARCAS);
    const p = genPlaca(rv);
    if (tracto) tractos.push(p); else carretas.push(p);
    await prisma.vehiculo.create({ data: {
      sedeId, placa: p, tipo: tracto ? 'Tracto' : 'Carreta',
      marca: tracto ? marca : pick(rv, ['Fameca', 'Randon', 'Montenegro']),
      modelo: tracto ? pick(rv, MODELOS[marca]) : pick(rv, ['Portacontenedor', "Plataforma 40'", 'Cama baja']),
      anio: int(rv, 2015, 2024), kilometraje: tracto ? int(rv, 90, 620) * 1000 : 0,
      estado: pick(rv, ['Operativo', 'Operativo', 'Operativo', 'En taller', 'Inactivo']),
    } });
  }
  if (!tractos.length) tractos.push(genPlaca(rv));
  if (!carretas.length) carretas.push(genPlaca(rv));

  // Conductores (~11) con documentos (algunos por vencer/vencidos)
  const rc = rng(202 + salt);
  const offsets = [-8, -3, 6, 12, 18, 27, 40, 75, 120, 190];
  for (let i = 0; i < 11; i++) {
    const nombre = NOMBRES[(i + salt) % NOMBRES.length];
    const lic = 'Q' + int(rc, 39000000, 43000000);
    const nDocs = int(rc, 2, 3);
    await prisma.conductor.create({ data: {
      sedeId, nombre, licencia: lic, categoria: pick(rc, CAT), telefono: `9${int(rc, 10, 99)} ${int(rc, 100, 999)} ${int(rc, 100, 999)}`,
      documentos: { create: Array.from({ length: nDocs }, (_, k) => ({ tipo: k === 0 ? 'Licencia de conducir' : pick(rc, DOC), numero: k === 0 ? lic : `DOC-${int(rc, 10000, 99999)}`, vencimiento: d(pick(rc, offsets)) })) },
    } });
  }

  // Órdenes (~30)
  const ro = rng(303 + salt);
  for (let i = 0; i < 30; i++) {
    await prisma.ordenTrabajo.create({ data: {
      sedeId, fecha: d(-int(ro, 1, 120)), placa: pick(ro, tractos), tipo: pick(ro, TIPMANT), descripcion: pick(ro, MANTDESC),
      responsable: pick(ro, ['Luis Ramírez', 'Taller Diesel Pro', 'Taller Scania Lima', 'Mecánica Central']),
      conductor: pick(ro, NOMBRES), costo: int(ro, 15, 480) * 10, estado: pick(ro, ['Abierta', 'En proceso', 'Cerrada', 'Cerrada']),
    } });
  }

  // Repuestos (~28)
  const rr = rng(404 + salt);
  for (let i = 0; i < 28; i++) {
    await prisma.repuesto.create({ data: {
      sedeId, nombre: pick(rr, REP), categoria: pick(rr, REPCAT), calidad: pick(rr, CALID), cantidad: int(rr, 1, 8),
      garantia: pick(rr, ['6 meses', '12 meses', '24 meses', '20 000 km', '40 000 km']), proveedor: pick(rr, TIENDAS),
      costo: int(rr, 5, 300) * 10, fecha: d(-int(rr, 1, 150)),
    } });
  }

  // Neumáticos (~36)
  const rn = rng(505 + salt);
  for (let i = 0; i < 36; i++) {
    const kmI = int(rn, 100, 400) * 1000;
    await prisma.neumatico.create({ data: {
      sedeId, placa: pick(rn, tractos), posicion: pick(rn, POS), marca: pick(rn, LLANTAS), kmInstalacion: kmI, kmActual: kmI + int(rn, 5, 120) * 1000,
      costo: int(rn, 110, 145) * 10, tienda: pick(rn, TIENDAS), estado: pick(rn, ['Nuevo', 'En uso', 'En uso', 'En uso', 'Para rotar', 'Reencauche', 'Descartado']),
    } });
  }

  // Viajes (~35)
  const rt = rng(606 + salt);
  const contPfx = ['PCIU', 'HPCU', 'ONEU', 'BMOU', 'MSKU', 'TCLU', 'CAIU'];
  const offV = [-6, -3, -1, 0, 1, 2, 3, 5, 8, 12, 20];
  for (let i = 0; i < 35; i++) {
    const estado = pick(rt, ['Programado', 'En curso', 'En curso', 'Culminado', 'Culminado', 'Devuelto']);
    const cerrado = estado === 'Culminado' || estado === 'Devuelto';
    const destino = pick(rt, DISTRITOS);
    const tipoCarga = pick(rt, ['GRAL', 'IMO', 'REEFER']);
    const comisionChofer = tarifaMonto(destino, tipoCarga);
    const cliente = pick(rt, CLIENTES);
    await prisma.viaje.create({ data: {
      sedeId, codigo: 'OP-' + pad(i + 1, 4), placaTracto: pick(rt, tractos), carreta: pick(rt, carretas), conductor: pick(rt, NOMBRES), cliente, clienteRuc: rucDe[cliente] ?? '',
      operacion: rt() > 0.5 ? 'IMPO' : 'EXPO', contenedor: `${pick(rt, contPfx)}${int(rt, 1000000, 9999999)}`,
      tamanio: pick(rt, ["20'", "40'", "40' HC"]), tipoCarga,
      horaCita: `${pad(int(rt, 5, 18), 2)}:00`, origen: pick(rt, PUERTOS), destino, devolucion: pick(rt, DEVOL),
      comisionChofer, comisionPagada: rt() > 0.55,
      fechaLimite: d(pick(rt, offV)), estado, nOrden: `26/030${pad(int(rt, 100, 900))}`,
      greRemitente: cerrado || rt() > 0.4 ? `T001-${int(rt, 26000, 27999)}` : '',
      greTransporte: cerrado || rt() > 0.5 ? `V001-${pad(int(rt, 1000, 1999))}` : '',
      factura: cerrado && rt() > 0.3 ? `F001-${pad(int(rt, 1000, 1999))}` : '',
    } });
  }

  // Facturas (~32)
  const rf = rng(707 + salt);
  for (let i = 0; i < 32; i++) {
    const monto = int(rf, 40, 320) * 10;
    const tipo = pick(rf, ['Factura', 'Factura', 'Factura', 'Boleta', 'N. Crédito']);
    await prisma.factura.create({ data: {
      sedeId, serie: `${tipo === 'Boleta' ? 'B' : 'F'}001-${pad(int(rf, 1000, 1999))}`, tipo,
      cliente: tipo === 'Boleta' ? 'Cliente varios' : pick(rf, CLIENTES), ruc: tipo === 'Boleta' ? '-' : `20${int(rf, 400000000, 620000000)}`,
      fecha: d(-int(rf, 1, 120)), viaje: `${pick(rf, contPfx)}${int(rf, 1000000, 9999999)}`,
      monto, igv: Math.round(monto * 0.18 * 100) / 100, estadoSunat: pick(rf, ['Emitida', 'Aceptada', 'Aceptada', 'Pagada', 'Pagada', 'Anulada']),
    } });
  }

  // Empleados (~16)
  const re = rng(808 + salt);
  for (let i = 0; i < 16; i++) {
    const chofer = re() > 0.4;
    await prisma.empleado.create({ data: {
      sedeId, nombre: NOMBRES[(i + salt + 3) % NOMBRES.length], cargo: chofer ? `Chofer ${pick(re, CAT)}` : pick(re, CARGOADM),
      tipo: chofer ? 'Chofer' : 'Administrativo', sueldoBase: chofer ? int(re, 240, 320) * 10 : int(re, 180, 400) * 10,
      bonos: int(re, 10, 60) * 10, descuentos: int(re, 15, 45) * 10, periodo: 'Julio 2026', estadoPago: re() > 0.45 ? 'Pagado' : 'Pendiente',
    } });
  }
}

async function main() {
  console.log('🌱 Sembrando base de datos (multi-sede)…');

  await prisma.documentoConductor.deleteMany();
  await prisma.conductor.deleteMany();
  await prisma.documentoVehiculo.deleteMany();
  await prisma.vehiculo.deleteMany();
  await prisma.tipoOperacion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.puerto.deleteMany();
  await prisma.comision.deleteMany();
  await prisma.ordenTrabajo.deleteMany();
  await prisma.repuesto.deleteMany();
  await prisma.neumatico.deleteMany();
  await prisma.viaje.deleteMany();
  await prisma.factura.deleteMany();
  await prisma.empleado.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.sede.deleteMany();

  // Sedes (orden en el login: MGR, MJG en el medio, MGR Servicios Integrados)
  const mgr = await prisma.sede.create({ data: { codigo: 'mgr', nombre: 'Transportes y Servicios MGR S.A.C.', ruc: '20608118153', orden: 1 } });
  const mjg = await prisma.sede.create({ data: { codigo: 'mjg', nombre: 'MJG Transportes S.A.C.', ruc: '20614975831', orden: 2 } });
  const mgrsi = await prisma.sede.create({ data: { codigo: 'mgrsi', nombre: 'MGR Servicios Integrados S.A.C.', ruc: '20616110340', orden: 3 } });

  // Usuarios globales (pueden ingresar a cualquier sede)
  const users = [
    { nombre: 'Jose Luis Meza', email: 'admin@transporte.pe', password: 'admin123', rol: 'Administrador' },
    { nombre: 'Erik Zerpa', email: 'gerente@transporte.pe', password: 'gerente123', rol: 'Administrador' },
    { nombre: 'Rosa Quispe', email: 'operador@transporte.pe', password: 'operador123', rol: 'Operador' },
    { nombre: 'Luis Ramírez', email: 'mecanico@transporte.pe', password: 'mecanico123', rol: 'Mecánico' },
  ];
  for (const u of users) {
    await prisma.usuario.create({ data: { ...u, password: await bcrypt.hash(u.password, 10), activo: true } });
  }

  await seedSede(mgr.id, 0);
  await seedSede(mjg.id, 500);
  await seedSede(mgrsi.id, 900);

  const counts = {
    sedes: await prisma.sede.count(), usuarios: await prisma.usuario.count(),
    vehiculos: await prisma.vehiculo.count(), conductores: await prisma.conductor.count(),
    ordenes: await prisma.ordenTrabajo.count(), repuestos: await prisma.repuesto.count(),
    neumaticos: await prisma.neumatico.count(), viajes: await prisma.viaje.count(),
    facturas: await prisma.factura.count(), empleados: await prisma.empleado.count(),
  };
  console.log('✅ Seed completo:', counts);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
