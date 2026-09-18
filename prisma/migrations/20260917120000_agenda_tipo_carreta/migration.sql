-- Tipo de carreta requerida para el servicio agendado.
ALTER TABLE "agenda" ADD COLUMN IF NOT EXISTS "tipoCarreta" TEXT NOT NULL DEFAULT '';
