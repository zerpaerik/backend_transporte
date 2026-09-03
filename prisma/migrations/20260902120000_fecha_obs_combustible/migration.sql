-- Viaje: fecha del viaje (manual) y observación
ALTER TABLE "viajes" ADD COLUMN "fechaViaje" DATE;
ALTER TABLE "viajes" ADD COLUMN "observacion" TEXT NOT NULL DEFAULT '';

-- Registro de abastecimiento de combustible
CREATE TABLE "combustible" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "placa" TEXT NOT NULL,
    "tipoCombustible" TEXT NOT NULL DEFAULT 'Diésel',
    "kilometraje" INTEGER NOT NULL DEFAULT 0,
    "galones" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tipoPago" TEXT NOT NULL DEFAULT '',
    "observacion" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sedeId" TEXT NOT NULL,
    CONSTRAINT "combustible_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "combustible_sedeId_idx" ON "combustible"("sedeId");
