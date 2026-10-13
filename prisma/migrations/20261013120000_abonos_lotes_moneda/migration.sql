-- AlterTable
ALTER TABLE "facturas" ADD COLUMN "detraccionLote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "viajes" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'PEN';

-- CreateTable
CREATE TABLE "factura_abonos" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "nota" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factura_abonos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detraccion_lotes" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "facturas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contenido" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detraccion_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "factura_abonos_facturaId_idx" ON "factura_abonos"("facturaId");

-- CreateIndex
CREATE UNIQUE INDEX "detraccion_lotes_sedeId_numero_key" ON "detraccion_lotes"("sedeId", "numero");

-- CreateIndex
CREATE INDEX "detraccion_lotes_sedeId_idx" ON "detraccion_lotes"("sedeId");

-- AddForeignKey
ALTER TABLE "factura_abonos" ADD CONSTRAINT "factura_abonos_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Las facturas ya marcadas como pagadas pasan a tener un abono con lo cobrado
-- (si no se registró el monto, se toma el neto: total menos la detracción).
INSERT INTO "factura_abonos" ("id", "facturaId", "fecha", "monto", "nota")
SELECT gen_random_uuid()::text, f."id",
       COALESCE(f."fechaPago", f."updatedAt"::date),
       CASE WHEN f."montoCobrado" > 0 THEN f."montoCobrado"
            ELSE COALESCE(NULLIF(f."total", 0), f."monto" + f."igv") - CASE WHEN f."sujetoDetraccion" THEN f."montoDetraccion" ELSE 0 END END,
       f."notaPago"
FROM "facturas" f
WHERE f."pagada" = true;
