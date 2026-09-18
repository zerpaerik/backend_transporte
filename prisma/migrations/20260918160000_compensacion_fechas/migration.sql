-- Fechas de la compensación: cuándo se registró la devolución cruzada y cuándo se saldó.
-- Sin ellas no se puede saber a qué periodo corresponde el pago al conductor.
ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "devueltoPorEn" TIMESTAMP(3);
ALTER TABLE "viajes" ADD COLUMN IF NOT EXISTS "compensacionEn" TIMESTAMP(3);

-- Los cruces ya registrados se fechan con lo mejor que hay: el momento en que se
-- dio por devuelto y, a falta de eso, la última vez que se tocó el viaje.
UPDATE "viajes"
SET "devueltoPorEn" = COALESCE("devueltoEn", "updatedAt")
WHERE "devueltoPor" <> '' AND "devueltoPor" <> "conductor" AND "devueltoPorEn" IS NULL;

-- Las que ya estaban saldadas se fechan igual, para que no queden sin fecha en el índice.
UPDATE "viajes"
SET "compensacionEn" = COALESCE("devueltoEn", "updatedAt")
WHERE "compensacionEstado" IN ('Compensada', 'Pagada') AND "compensacionEn" IS NULL;
