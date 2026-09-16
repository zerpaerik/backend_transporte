-- Guía de remisión del transportista referenciada en el comprobante (además de la del remitente).
ALTER TABLE "facturas" ADD COLUMN IF NOT EXISTS "guiaTransportista" TEXT NOT NULL DEFAULT '';
