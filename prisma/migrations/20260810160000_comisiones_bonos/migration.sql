-- Comisiones: reemplazar 'monto' por tarifario por tipo de carga (gral/imo/reefer)
ALTER TABLE "comisiones" DROP COLUMN IF EXISTS "monto";
ALTER TABLE "comisiones" ADD COLUMN "gral" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "comisiones" ADD COLUMN "imo" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "comisiones" ADD COLUMN "reefer" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Viajes: control de pago de la comisión del chofer
ALTER TABLE "viajes" ADD COLUMN "comisionPagada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "viajes" ADD COLUMN "comisionFechaPago" DATE;
