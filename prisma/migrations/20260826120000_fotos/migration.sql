-- Foto del conductor y del vehículo (se guarda como binario en la BD)
ALTER TABLE "conductores" ADD COLUMN "foto" BYTEA;
ALTER TABLE "conductores" ADD COLUMN "fotoMime" TEXT;

ALTER TABLE "vehiculos" ADD COLUMN "foto" BYTEA;
ALTER TABLE "vehiculos" ADD COLUMN "fotoMime" TEXT;
