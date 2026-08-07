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
const placa = (r: () => number) => { const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'.split(''); return `${pick(r, L)}${pick(r, L)}${pick(r, L)}-${int(r, 100, 999)}`; };

async function main() {
  console.log('🌱 Sembrando base de datos…');

  // Limpieza (orden por dependencias)
  await prisma.documentoConductor.deleteMany();
  await prisma.conductor.deleteMany();
  await prisma.vehiculo.deleteMany();
  await prisma.ordenTrabajo.deleteMany();
  await prisma.repuesto.deleteMany();
  await prisma.neumatico.deleteMany();
  await prisma.viaje.deleteMany();
  await prisma.factura.deleteMany();
  await prisma.empleado.deleteMany();
  await prisma.usuario.deleteMany();

  // Usuarios de prueba
  const users = [
    { nombre: 'Jose Luis Meza', email: 'admin@transporte.pe', password: 'admin123', rol: 'Administrador' },
    { nombre: 'Erik Zerpa', email: 'gerente@transporte.pe', password: 'gerente123', rol: 'Administrador' },
    { nombre: 'Rosa Quispe', email: 'operador@transporte.pe', password: 'operador123', rol: 'Operador' },
    { nombre: 'Luis Ramírez', email: 'mecanico@transporte.pe', password: 'mecanico123', rol: 'Mecánico' },
  ];
  for (const u of users) {
    await prisma.usuario.create({ data: { ...u, password: await bcrypt.hash(u.password, 10), activo: true } });
  }

  // Vehículos
  const tractos: string[] = ['AAT-843', 'AAT-945', 'AHM-708', 'BHC-935', 'F9A-860'];
  const carretas: string[] = ['A6V-985', 'BSB-973', 'C2A-993'];
  await prisma.vehiculo.createMany({ data: [
    { placa: 'AAT-843', tipo: 'Tracto', marca: 'Volvo', modelo: 'FH 460', anio: 2019, kilometraje: 412300, estado: 'Operativo' },
    { placa: 'AAT-945', tipo: 'Tracto', marca: 'Scania', modelo: 'R450', anio: 2021, kilometraje: 238100, estado: 'Operativo' },
    { placa: 'AHM-708', tipo: 'Tracto', marca: 'Freightliner', modelo: 'Cascadia', anio: 2018, kilometraje: 528900, estado: 'En taller' },
    { placa: 'BHC-935', tipo: 'Tracto', marca: 'International', modelo: 'ProStar', anio: 2020, kilometraje: 301450, estado: 'Operativo' },
    { placa: 'F9A-860', tipo: 'Tracto', marca: 'Volvo', modelo: 'FH 500', anio: 2022, kilometraje: 156700, estado: 'Operativo' },
    { placa: 'A6V-985', tipo: 'Carreta', marca: 'Fameca', modelo: 'Portacontenedor', anio: 2018, kilometraje: 0, estado: 'Operativo' },
    { placa: 'BSB-973', tipo: 'Carreta', marca: 'Randon', modelo: "Plataforma 40'", anio: 2020, kilometraje: 0, estado: 'Operativo' },
    { placa: 'C2A-993', tipo: 'Carreta', marca: 'Fameca', modelo: 'Portacontenedor', anio: 2019, kilometraje: 0, estado: 'Inactivo' },
  ] });
  const rv = rng(101);
  for (let i = 0; i < 16; i++) {
    const tracto = rv() > 0.35; const marca = pick(rv, MARCAS); const p = placa(rv);
    if (tracto) tractos.push(p); else carretas.push(p);
    await prisma.vehiculo.create({ data: {
      placa: p, tipo: tracto ? 'Tracto' : 'Carreta',
      marca: tracto ? marca : pick(rv, ['Fameca', 'Randon', 'Montenegro']),
      modelo: tracto ? pick(rv, MODELOS[marca]) : pick(rv, ['Portacontenedor', "Plataforma 40'", 'Cama baja']),
      anio: int(rv, 2015, 2024), kilometraje: tracto ? int(rv, 90, 620) * 1000 : 0,
      estado: pick(rv, ['Operativo', 'Operativo', 'Operativo', 'En taller', 'Inactivo']),
    } });
  }

  // Conductores + documentos
  const rc = rng(202);
  const seedCond = [
    { nombre: 'Julio Grimaldo', licencia: 'Q40128761', categoria: 'A-IIIC', telefono: '987 654 321', docs: [['Licencia de conducir', 9], ['Certificado MTC', 201], ['Examen médico', 25]] },
    { nombre: 'Jose Palomino', licencia: 'Q39887120', categoria: 'A-IIIC', telefono: '986 112 233', docs: [['Licencia de conducir', 94], ['SCTR', 15]] },
    { nombre: 'Ronald Saavedra', licencia: 'Q41220198', categoria: 'A-IIIB', telefono: '999 445 780', docs: [['Licencia de conducir', -4], ['Certificado MTC', 43]] },
  ];
  for (const c of seedCond) {
    await prisma.conductor.create({ data: {
      nombre: c.nombre, licencia: c.licencia, categoria: c.categoria, telefono: c.telefono,
      documentos: { create: c.docs.map(([tipo, off]) => ({ tipo: tipo as string, numero: c.licencia, vencimiento: d(off as number) })) },
    } });
  }
  const offsets = [-8, -3, 6, 12, 18, 27, 40, 75, 120, 190];
  for (let i = 0; i < 11; i++) {
    const nombre = NOMBRES[(i + 5) % NOMBRES.length]; const lic = 'Q' + int(rc, 39000000, 43000000); const nDocs = int(rc, 2, 3);
    await prisma.conductor.create({ data: {
      nombre, licencia: lic, categoria: pick(rc, CAT), telefono: `9${int(rc, 10, 99)} ${int(rc, 100, 999)} ${int(rc, 100, 999)}`,
      documentos: { create: Array.from({ length: nDocs }, (_, k) => ({ tipo: k === 0 ? 'Licencia de conducir' : pick(rc, DOC), numero: k === 0 ? lic : `DOC-${int(rc, 10000, 99999)}`, vencimiento: d(pick(rc, offsets)) })) },
    } });
  }

  // Órdenes de trabajo
  const ro = rng(303);
  const placasT = tractos;
  for (let i = 0; i < 40; i++) {
    await prisma.ordenTrabajo.create({ data: {
      fecha: d(-int(ro, 1, 120)), placa: pick(ro, placasT), tipo: pick(ro, TIPMANT), descripcion: pick(ro, MANTDESC),
      responsable: pick(ro, ['Luis Ramírez', 'Taller Diesel Pro', 'Taller Scania Lima', 'Mecánica Central']),
      conductor: pick(ro, NOMBRES), costo: int(ro, 15, 480) * 10, estado: pick(ro, ['Abierta', 'En proceso', 'Cerrada', 'Cerrada']),
    } });
  }

  // Repuestos
  const rr = rng(404);
  for (let i = 0; i < 36; i++) {
    await prisma.repuesto.create({ data: {
      nombre: pick(rr, REP), categoria: pick(rr, REPCAT), calidad: pick(rr, CALID), cantidad: int(rr, 1, 8),
      garantia: pick(rr, ['6 meses', '12 meses', '24 meses', '20 000 km', '40 000 km']), proveedor: pick(rr, TIENDAS),
      costo: int(rr, 5, 300) * 10, fecha: d(-int(rr, 1, 150)),
    } });
  }

  // Neumáticos
  const rn = rng(505);
  for (let i = 0; i < 48; i++) {
    const kmI = int(rn, 100, 400) * 1000;
    await prisma.neumatico.create({ data: {
      placa: pick(rn, placasT), posicion: pick(rn, POS), marca: pick(rn, LLANTAS), kmInstalacion: kmI, kmActual: kmI + int(rn, 5, 120) * 1000,
      costo: int(rn, 110, 145) * 10, tienda: pick(rn, TIENDAS), estado: pick(rn, ['Nuevo', 'En uso', 'En uso', 'En uso', 'Para rotar', 'Reencauche', 'Descartado']),
    } });
  }

  // Viajes
  const rt = rng(606);
  const contPfx = ['PCIU', 'HPCU', 'ONEU', 'BMOU', 'MSKU', 'TCLU', 'CAIU'];
  const offV = [-6, -3, -1, 0, 1, 2, 3, 5, 8, 12, 20];
  for (let i = 0; i < 45; i++) {
    const estado = pick(rt, ['Programado', 'En curso', 'En curso', 'Culminado', 'Culminado', 'Devuelto']);
    const cerrado = estado === 'Culminado' || estado === 'Devuelto';
    await prisma.viaje.create({ data: {
      placaTracto: pick(rt, tractos), carreta: pick(rt, carretas), conductor: pick(rt, NOMBRES), cliente: pick(rt, CLIENTES),
      operacion: rt() > 0.5 ? 'IMPO' : 'EXPO', contenedor: `${pick(rt, contPfx)}${int(rt, 1000000, 9999999)}`,
      tamanio: pick(rt, ["20'", "40'", "40' HC"]), tipoCarga: pick(rt, ['GRAL', 'IMO', 'REEFER', 'GRAL']),
      horaCita: `${pad(int(rt, 5, 18), 2)}:00`, origen: pick(rt, PUERTOS), destino: pick(rt, DESTINOS), devolucion: pick(rt, DEVOL),
      fechaLimite: d(pick(rt, offV)), estado, nOrden: `26/030${pad(int(rt, 100, 900))}`,
      greRemitente: cerrado || rt() > 0.4 ? `T001-${int(rt, 26000, 27999)}` : '',
      greTransporte: cerrado || rt() > 0.5 ? `V001-${pad(int(rt, 1000, 1999))}` : '',
      factura: cerrado && rt() > 0.3 ? `F001-${pad(int(rt, 1000, 1999))}` : '',
    } });
  }

  // Facturas
  const rf = rng(707);
  for (let i = 0; i < 40; i++) {
    const monto = int(rf, 40, 320) * 10; const tipo = pick(rf, ['Factura', 'Factura', 'Factura', 'Boleta', 'N. Crédito']);
    await prisma.factura.create({ data: {
      serie: `${tipo === 'Boleta' ? 'B' : 'F'}001-${pad(int(rf, 1000, 1999))}`, tipo,
      cliente: tipo === 'Boleta' ? 'Cliente varios' : pick(rf, CLIENTES), ruc: tipo === 'Boleta' ? '-' : `20${int(rf, 400000000, 620000000)}`,
      fecha: d(-int(rf, 1, 120)), viaje: `${pick(rf, contPfx)}${int(rf, 1000000, 9999999)}`,
      monto, igv: Math.round(monto * 0.18 * 100) / 100, estadoSunat: pick(rf, ['Emitida', 'Aceptada', 'Aceptada', 'Pagada', 'Pagada', 'Anulada']),
    } });
  }

  // Empleados
  const re = rng(808);
  for (let i = 0; i < 20; i++) {
    const chofer = re() > 0.4;
    await prisma.empleado.create({ data: {
      nombre: NOMBRES[(i + 2) % NOMBRES.length], cargo: chofer ? `Chofer ${pick(re, CAT)}` : pick(re, CARGOADM),
      tipo: chofer ? 'Chofer' : 'Administrativo', sueldoBase: chofer ? int(re, 240, 320) * 10 : int(re, 180, 400) * 10,
      bonos: int(re, 10, 60) * 10, descuentos: int(re, 15, 45) * 10, periodo: 'Julio 2026', estadoPago: re() > 0.45 ? 'Pagado' : 'Pendiente',
    } });
  }

  const counts = {
    usuarios: await prisma.usuario.count(), vehiculos: await prisma.vehiculo.count(), conductores: await prisma.conductor.count(),
    ordenes: await prisma.ordenTrabajo.count(), repuestos: await prisma.repuesto.count(), neumaticos: await prisma.neumatico.count(),
    viajes: await prisma.viaje.count(), facturas: await prisma.factura.count(), empleados: await prisma.empleado.count(),
  };
  console.log('✅ Seed completo:', counts);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
