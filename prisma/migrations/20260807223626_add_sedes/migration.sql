-- CreateTable
CREATE TABLE "sedes" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sedes_codigo_key" ON "sedes"("codigo");

-- AlterTable (columna sedeId con default temporal para respaldar filas existentes, luego se quita el default)
ALTER TABLE "conductores" ADD COLUMN "sedeId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "conductores" ALTER COLUMN "sedeId" DROP DEFAULT;
ALTER TABLE "empleados" ADD COLUMN "sedeId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "empleados" ALTER COLUMN "sedeId" DROP DEFAULT;
ALTER TABLE "facturas" ADD COLUMN "sedeId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "facturas" ALTER COLUMN "sedeId" DROP DEFAULT;
ALTER TABLE "neumaticos" ADD COLUMN "sedeId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "neumaticos" ALTER COLUMN "sedeId" DROP DEFAULT;
ALTER TABLE "ordenes_trabajo" ADD COLUMN "sedeId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ordenes_trabajo" ALTER COLUMN "sedeId" DROP DEFAULT;
ALTER TABLE "repuestos" ADD COLUMN "sedeId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "repuestos" ALTER COLUMN "sedeId" DROP DEFAULT;
ALTER TABLE "vehiculos" ADD COLUMN "sedeId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehiculos" ALTER COLUMN "sedeId" DROP DEFAULT;
ALTER TABLE "viajes" ADD COLUMN "sedeId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "viajes" ALTER COLUMN "sedeId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "conductores_sedeId_idx" ON "conductores"("sedeId");
CREATE INDEX "empleados_sedeId_idx" ON "empleados"("sedeId");
CREATE INDEX "facturas_sedeId_idx" ON "facturas"("sedeId");
CREATE INDEX "neumaticos_sedeId_idx" ON "neumaticos"("sedeId");
CREATE INDEX "ordenes_trabajo_sedeId_idx" ON "ordenes_trabajo"("sedeId");
CREATE INDEX "repuestos_sedeId_idx" ON "repuestos"("sedeId");
CREATE INDEX "vehiculos_sedeId_idx" ON "vehiculos"("sedeId");
CREATE INDEX "viajes_sedeId_idx" ON "viajes"("sedeId");
