-- Cobranzas: estado de pago de la factura (independiente del estado SUNAT) y comprobantes de pago
ALTER TABLE "facturas"
  ADD COLUMN "pagada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fechaPago" DATE,
  ADD COLUMN "notaPago" TEXT NOT NULL DEFAULT '';

CREATE TABLE "factura_comprobantes_pago" (
  "id" TEXT NOT NULL,
  "facturaId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL DEFAULT 'comprobante',
  "mime" TEXT NOT NULL DEFAULT 'application/octet-stream',
  "archivo" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "factura_comprobantes_pago_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "factura_comprobantes_pago_facturaId_idx" ON "factura_comprobantes_pago"("facturaId");
ALTER TABLE "factura_comprobantes_pago" ADD CONSTRAINT "factura_comprobantes_pago_facturaId_fkey"
  FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
