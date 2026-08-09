import { PrismaClient } from '@prisma/client';

// Sincroniza las SEDES sin tocar ningún otro dato (idempotente).
// Crea las que falten y actualiza nombre/ruc/orden de las existentes.
// Seguro para producción: NO borra viajes, documentos, etc.
//
// Ejecutar:  npm run sedes
// En Railway: pestaña Shell del servicio → npm run sedes

const prisma = new PrismaClient();

const SEDES = [
  { codigo: 'mgr', nombre: 'Transportes y Servicios MGR S.A.C.', ruc: '20608118153', orden: 1 },
  { codigo: 'mjg', nombre: 'MJG Transportes S.A.C.', ruc: '20614975831', orden: 2 },
  { codigo: 'mgrsi', nombre: 'MGR Servicios Integrados S.A.C.', ruc: '20616110340', orden: 3 },
];

async function main() {
  console.log('🏢 Sincronizando sedes (sin afectar otros datos)…');
  for (const s of SEDES) {
    await prisma.sede.upsert({
      where: { codigo: s.codigo },
      update: { nombre: s.nombre, ruc: s.ruc, orden: s.orden, activa: true },
      create: { ...s, activa: true },
    });
  }
  const todas = await prisma.sede.findMany({ orderBy: { orden: 'asc' }, select: { codigo: true, nombre: true, ruc: true, orden: true } });
  console.log('✅ Sedes actuales:', todas);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
