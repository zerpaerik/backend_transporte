-- AlterTable
ALTER TABLE "documentos_conductor" ADD COLUMN     "archivo" BYTEA,
ADD COLUMN     "archivoMime" TEXT,
ADD COLUMN     "archivoNombre" TEXT;

-- CreateTable
CREATE TABLE "documentos_vehiculo" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT NOT NULL DEFAULT '',
    "vencimiento" DATE NOT NULL,
    "archivo" BYTEA,
    "archivoNombre" TEXT,
    "archivoMime" TEXT,
    "vehiculoId" TEXT NOT NULL,

    CONSTRAINT "documentos_vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_operacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_operacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_vehiculo_vehiculoId_idx" ON "documentos_vehiculo"("vehiculoId");

-- CreateIndex
CREATE INDEX "tipos_operacion_sedeId_idx" ON "tipos_operacion"("sedeId");

-- AddForeignKey
ALTER TABLE "documentos_vehiculo" ADD CONSTRAINT "documentos_vehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
