-- Fecha y hora en la que el viaje debe estar en el cliente
ALTER TABLE "viajes" ADD COLUMN "fechaCliente" DATE;
ALTER TABLE "viajes" ADD COLUMN "horaCliente" TEXT NOT NULL DEFAULT '';
