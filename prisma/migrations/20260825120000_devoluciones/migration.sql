-- Control de devolución de contenedores (importación)
ALTER TABLE "viajes" ADD COLUMN "citaFecha" DATE;
ALTER TABLE "viajes" ADD COLUMN "citaHora" TEXT NOT NULL DEFAULT '';
ALTER TABLE "viajes" ADD COLUMN "lugarGuardado" TEXT NOT NULL DEFAULT '';
ALTER TABLE "viajes" ADD COLUMN "estadoDevolucion" TEXT NOT NULL DEFAULT 'Pendiente';
ALTER TABLE "viajes" ADD COLUMN "citaArchivo" BYTEA;
ALTER TABLE "viajes" ADD COLUMN "citaArchivoNombre" TEXT;
ALTER TABLE "viajes" ADD COLUMN "citaArchivoMime" TEXT;

-- Catálogo de lugares de guardado (guardianía)
CREATE TABLE "lugares_guardado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lugares_guardado_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lugares_guardado_sedeId_idx" ON "lugares_guardado"("sedeId");
