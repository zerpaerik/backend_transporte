import { PrismaClient } from '@prisma/client';

// Elimina TODOS los datos operativos, conservando SEDES y USUARIOS.
// Úsalo para dejar la base lista para cargar datos reales, sin perder el
// acceso (usuarios) ni las empresas (sedes).
//
// Ejecutar:  npm run limpiar
// En Railway: pestaña Shell del servicio → npm run limpiar

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Eliminando datos operativos (se conservan SEDES y USUARIOS)…');

  // Orden por dependencias (documentos antes que conductores).
  const borrados = {
    documentos: (await prisma.documentoConductor.deleteMany()).count,
    conductores: (await prisma.conductor.deleteMany()).count,
    vehiculos: (await prisma.vehiculo.deleteMany()).count,
    ordenes: (await prisma.ordenTrabajo.deleteMany()).count,
    repuestos: (await prisma.repuesto.deleteMany()).count,
    neumaticos: (await prisma.neumatico.deleteMany()).count,
    viajes: (await prisma.viaje.deleteMany()).count,
    facturas: (await prisma.factura.deleteMany()).count,
    empleados: (await prisma.empleado.deleteMany()).count,
  };

  const conservados = {
    sedes: await prisma.sede.count(),
    usuarios: await prisma.usuario.count(),
  };

  console.log('🗑️  Registros eliminados:', borrados);
  console.log('✅ Conservados:', conservados);
  console.log('La base quedó vacía de datos operativos y lista para cargar información real.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
