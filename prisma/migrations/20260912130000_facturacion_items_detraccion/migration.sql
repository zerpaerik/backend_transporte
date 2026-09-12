-- Líneas de factura y datos de detracción del transporte — aditivo.

ALTER TABLE "facturas"
  ADD COLUMN "valorReferencial" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "referenciaVR" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ubigeoOrigen" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ubigeoDestino" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "detalleViaje" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "formaPago" TEXT NOT NULL DEFAULT 'Contado',
  ADD COLUMN "fechaVencimiento" DATE;

CREATE TABLE "factura_items" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "valorUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "afectacion" TEXT NOT NULL DEFAULT '10',
    "unidad" TEXT NOT NULL DEFAULT 'ZZ',
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "factura_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "factura_items_facturaId_idx" ON "factura_items"("facturaId");

ALTER TABLE "factura_items" ADD CONSTRAINT "factura_items_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
