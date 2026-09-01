-- Aprobación previa al pago de una planilla
ALTER TABLE "planillas" ADD COLUMN "aprobadaPor" TEXT NOT NULL DEFAULT '';
ALTER TABLE "planillas" ADD COLUMN "aprobadaEn" TIMESTAMP(3);

-- Varios descuentos manuales por planilla (antes solo había uno)
CREATE TABLE "planilla_descuentos" (
    "id" TEXT NOT NULL,
    "planillaId" TEXT NOT NULL,
    "concepto" TEXT NOT NULL DEFAULT '',
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "planilla_descuentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planilla_descuentos_planillaId_idx" ON "planilla_descuentos"("planillaId");

ALTER TABLE "planilla_descuentos" ADD CONSTRAINT "planilla_descuentos_planillaId_fkey" FOREIGN KEY ("planillaId") REFERENCES "planillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar el descuento único existente al nuevo esquema, con el concepto "Cuota semanal"
INSERT INTO "planilla_descuentos" ("id", "planillaId", "concepto", "monto", "orden")
SELECT gen_random_uuid(), "id", 'Cuota semanal', "descuentoPlanilla", 0
FROM "planillas"
WHERE "descuentoPlanilla" > 0;
