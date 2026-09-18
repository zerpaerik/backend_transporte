-- Compensación de devoluciones entre conductores: quién devolvió el contenedor y el
-- estado de la compensación cuando lo devuelve un conductor distinto al del viaje.
ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "devueltoPor" TEXT NOT NULL DEFAULT '';
ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "compensacionEstado" TEXT NOT NULL DEFAULT '';
ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "compensacionMonto" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "compensacionNota" TEXT NOT NULL DEFAULT '';
