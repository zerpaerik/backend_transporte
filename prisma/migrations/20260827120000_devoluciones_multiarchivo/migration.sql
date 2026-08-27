-- Archivado automático de devoluciones (a los 15 días en "Devuelto"), sin tocar Operaciones
ALTER TABLE "viajes" ADD COLUMN "devueltoEn" TIMESTAMP(3);
ALTER TABLE "viajes" ADD COLUMN "devolucionArchivada" BOOLEAN NOT NULL DEFAULT false;

-- Varios archivos de la cita del puerto por viaje
CREATE TABLE "cita_archivos" (
    "id" TEXT NOT NULL,
    "viajeId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'application/pdf',
    "archivo" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cita_archivos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cita_archivos_viajeId_idx" ON "cita_archivos"("viajeId");

ALTER TABLE "cita_archivos" ADD CONSTRAINT "cita_archivos_viajeId_fkey" FOREIGN KEY ("viajeId") REFERENCES "viajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar el adjunto único existente (citaArchivo) a la nueva tabla de varios archivos
INSERT INTO "cita_archivos" ("id", "viajeId", "nombre", "mime", "archivo", "createdAt")
SELECT gen_random_uuid(), "id", COALESCE("citaArchivoNombre", 'cita'), COALESCE("citaArchivoMime", 'application/pdf'), "citaArchivo", CURRENT_TIMESTAMP
FROM "viajes"
WHERE "citaArchivo" IS NOT NULL;

-- Los que ya están en "Devuelto" arrancan el conteo de 15 días desde su última actualización
UPDATE "viajes" SET "devueltoEn" = "updatedAt" WHERE "estadoDevolucion" = 'Devuelto' AND "devueltoEn" IS NULL;
