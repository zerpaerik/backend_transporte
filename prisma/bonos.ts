import { PrismaClient } from '@prisma/client';

// Carga/actualiza el TARIFARIO DE BONOS (del Excel BONOS) en todas las sedes,
// SIN borrar ningún otro dato. Idempotente: crea las tarifas que falten y
// actualiza los montos de las existentes. Seguro para producción.
//
// Ejecutar:  npm run bonos
// En Railway: pestaña Shell del servicio → npm run bonos

const prisma = new PrismaClient();

// Tarifario oficial — Excel "BONOS 01.09.2026". [destino, GRAL, IMO, REEFER]
// Las celdas vacías del Excel (sin monto) se cargan como 0.
const TARIFAS: [string, number, number, number][] = [
  ['CALLAO', 80, 130, 110], ['BELLAVISTA', 80, 130, 110], ['CARMEN DE LA LEGUA', 80, 130, 110], ['LA PERLA', 80, 130, 110],
  ['SAN MIGUEL', 80, 130, 110], ['VENTANILLA', 80, 150, 110], ['PTE PIEDRA', 90, 150, 120], ['COMAS', 90, 150, 120],
  ['CERCADO DE LIMA', 90, 150, 120], ['SMP', 90, 150, 120], ['LOS OLIVOS', 90, 150, 120], ['INDEPENDENCIA', 90, 150, 120],
  ['RIMAC', 90, 150, 120], ['EL AGUSTINO', 90, 150, 120], ['BREÑA', 90, 150, 120], ['LA VICTORIA', 90, 150, 120],
  ['SJL', 90, 150, 120], ['SAN LUIS', 90, 150, 120], ['SANTA ANITA', 90, 150, 120], ['VITARTE', 90, 160, 120],
  ['SANTA CLARA', 90, 160, 120], ['HUACHIPA', 100, 160, 130], ['VES', 100, 170, 130], ['LURIGANCHO CARAPONGO', 100, 170, 130],
  ['CHORRILLOS', 100, 170, 130], ['VMT', 100, 170, 130], ['SJM', 100, 170, 130], ['ANCON', 100, 170, 130],
  ['CHACLACAYO', 100, 170, 130], ['CARABAYLLO', 100, 150, 130], ['LURIN', 110, 190, 140], ['PUNTA HERMOSA', 110, 190, 140],
  ['CHOSICA', 110, 190, 140], ['SAN ANTONIO', 110, 190, 140], ['CHILCA', 140, 200, 170], ['CAÑETE', 170, 0, 200],
  ['CHINCHA', 220, 0, 230], ['PISCO', 240, 0, 270], ['ICA', 270, 0, 300], ['HUAURA', 170, 0, 200],
  ['BARRANCA SUPE', 180, 0, 210], ['CASMA', 280, 0, 310], ['CHIMBOTE', 330, 0, 0], ['TRUJILLO', 420, 0, 0],
  ['TACNA', 600, 0, 0], ['CHONGOYAPE', 500, 0, 0], ['CHANCAY', 120, 0, 0],
];

async function main() {
  const sedes = await prisma.sede.findMany();
  if (!sedes.length) { console.log('⚠️  No hay sedes. Corre primero: npm run sedes'); return; }

  let creadas = 0, actualizadas = 0;
  for (const s of sedes) {
    for (const [destino, gral, imo, reefer] of TARIFAS) {
      const ex = await prisma.comision.findFirst({ where: { sedeId: s.id, destino } });
      if (ex) { await prisma.comision.update({ where: { id: ex.id }, data: { gral, imo, reefer } }); actualizadas++; }
      else { await prisma.comision.create({ data: { sedeId: s.id, destino, gral, imo, reefer } }); creadas++; }
    }
    // Asegurar tipo de operación "Carga suelta"
    const t = await prisma.tipoOperacion.findFirst({ where: { sedeId: s.id, nombre: 'Carga suelta' } });
    if (!t) await prisma.tipoOperacion.create({ data: { sedeId: s.id, nombre: 'Carga suelta' } });
  }
  console.log(`✅ Tarifario de bonos sincronizado en ${sedes.length} sede(s). Creadas: ${creadas}, actualizadas: ${actualizadas}.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
