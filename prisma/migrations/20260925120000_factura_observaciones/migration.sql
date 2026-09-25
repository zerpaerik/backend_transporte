-- Observaciones libres del comprobante (salen en la sección "Observaciones" del PDF, p. ej. la DAM)
ALTER TABLE "facturas" ADD COLUMN "observaciones" TEXT NOT NULL DEFAULT '';
