-- Valor referencial POR SERVICIO: una fila por viaje incluido en el comprobante.
-- El valor referencial de la factura pasa a ser la suma de estas filas; se guardan
-- los insumos del cálculo para poder recalcularlo desde las tablas del DS al emitir.
CREATE TABLE "factura_servicios_vr" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "detalle" TEXT NOT NULL DEFAULT '',
    "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ambito" TEXT NOT NULL DEFAULT '',
    "ruta" TEXT NOT NULL DEFAULT '',
    "destino" TEXT NOT NULL DEFAULT '',
    "puerto" TEXT NOT NULL DEFAULT '',
    "zona" TEXT NOT NULL DEFAULT '',
    "tipoCarga" TEXT NOT NULL DEFAULT '',
    "pesoTM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "factura_servicios_vr_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "factura_servicios_vr_facturaId_idx" ON "factura_servicios_vr"("facturaId");

ALTER TABLE "factura_servicios_vr" ADD CONSTRAINT "factura_servicios_vr_facturaId_fkey"
  FOREIGN KEY ("facturaId") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
