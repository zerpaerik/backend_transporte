-- Guía de remisión referenciada por la factura (columna "Guía" del comprobante).
ALTER TABLE "facturas" ADD COLUMN "guia" TEXT NOT NULL DEFAULT '';
