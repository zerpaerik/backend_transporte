-- Sueldo/día configurable por sede
ALTER TABLE "sedes" ADD COLUMN "sueldoDia" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Descuento mensual por conductor (se divide en 4 cuotas semanales)
ALTER TABLE "conductores" ADD COLUMN "descuentoMensual" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Planillas semanales por conductor
CREATE TABLE "planillas" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "conductor" TEXT NOT NULL,
    "semanaDesde" DATE NOT NULL,
    "semanaHasta" DATE NOT NULL,
    "sueldoDia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoPlanilla" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'Borrador',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "planillas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planillas_sedeId_idx" ON "planillas"("sedeId");

CREATE TABLE "planilla_lineas" (
    "id" TEXT NOT NULL,
    "planillaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "cliente" TEXT NOT NULL DEFAULT '',
    "origen" TEXT NOT NULL DEFAULT '',
    "destino" TEXT NOT NULL DEFAULT '',
    "sueldoDia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comision" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viaticos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "concepto" TEXT NOT NULL DEFAULT '',
    "viajeId" TEXT NOT NULL DEFAULT '',
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "planilla_lineas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "planilla_lineas_planillaId_idx" ON "planilla_lineas"("planillaId");

ALTER TABLE "planilla_lineas" ADD CONSTRAINT "planilla_lineas_planillaId_fkey" FOREIGN KEY ("planillaId") REFERENCES "planillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
