-- MEMO del viaje (alerta 72h antes)
ALTER TABLE "viajes" ADD COLUMN "memo" DATE;

-- Agenda de servicios
CREATE TABLE "agenda" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "cliente" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT '',
    "devolucion" TEXT NOT NULL DEFAULT '',
    "tipoCarga" TEXT NOT NULL DEFAULT 'GENERAL',
    "unidades" INTEGER NOT NULL DEFAULT 1,
    "observacion" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'Programado',
    "sedeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agenda_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agenda_sedeId_idx" ON "agenda"("sedeId");
