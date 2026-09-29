-- Monto cobrado de la factura y control de su detracción (quién la deposita y la constancia).
-- Las facturas ya marcadas como pagadas quedan con monto cobrado en 0 ("sin dato"): no se
-- inventa lo que entró al banco; se completa al volver a registrar el pago si hace falta.
ALTER TABLE "facturas"
  ADD COLUMN "montoCobrado" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "detraccionResponsable" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "detraccionFecha" DATE,
  ADD COLUMN "detraccionNumero" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "detraccionMonto" DOUBLE PRECISION NOT NULL DEFAULT 0;
