-- Origen/destino (dirección) del transporte, para el bloque de detracción de la factura
ALTER TABLE "facturas"
  ADD COLUMN "origen" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "destino" TEXT NOT NULL DEFAULT '';
