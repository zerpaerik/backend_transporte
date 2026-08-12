-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "direccion" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "facturas" ADD COLUMN     "direccion" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "viajes" ADD COLUMN     "clienteDireccion" TEXT NOT NULL DEFAULT '';
