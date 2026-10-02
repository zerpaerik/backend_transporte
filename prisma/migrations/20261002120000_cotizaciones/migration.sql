-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "validaHasta" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Borrador',
    "cliente" TEXT NOT NULL,
    "clienteRuc" TEXT NOT NULL DEFAULT '',
    "clienteDireccion" TEXT NOT NULL DEFAULT '',
    "empresaRazon" TEXT NOT NULL DEFAULT '',
    "empresaRuc" TEXT NOT NULL DEFAULT '',
    "empresaDireccion" TEXT NOT NULL DEFAULT '',
    "contactoNombre" TEXT NOT NULL DEFAULT '',
    "contactoEmail" TEXT NOT NULL DEFAULT '',
    "contactoTelefono" TEXT NOT NULL DEFAULT '',
    "moneda" TEXT NOT NULL DEFAULT 'PEN',
    "tipoCambio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoGlobal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igvPorc" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notas" TEXT NOT NULL DEFAULT '',
    "condiciones" TEXT NOT NULL DEFAULT '',
    "viajes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creadoPor" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizacion_items" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operacion" TEXT NOT NULL DEFAULT '',
    "origen" TEXT NOT NULL DEFAULT '',
    "destino" TEXT NOT NULL DEFAULT '',
    "devolucion" TEXT NOT NULL DEFAULT '',
    "tamanio" TEXT NOT NULL DEFAULT '',
    "tipoCarga" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "cotizacion_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_sedeId_numero_key" ON "cotizaciones"("sedeId", "numero");

-- CreateIndex
CREATE INDEX "cotizaciones_sedeId_idx" ON "cotizaciones"("sedeId");

-- CreateIndex
CREATE INDEX "cotizacion_items_cotizacionId_idx" ON "cotizacion_items"("cotizacionId");

-- AddForeignKey
ALTER TABLE "cotizacion_items" ADD CONSTRAINT "cotizacion_items_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
