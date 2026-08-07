-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'Operador',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "kilometraje" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'Operativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conductores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "licencia" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conductores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_conductor" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "vencimiento" DATE NOT NULL,
    "conductorId" TEXT NOT NULL,

    CONSTRAINT "documentos_conductor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_trabajo" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "placa" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "conductor" TEXT NOT NULL,
    "costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'Abierta',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repuestos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "calidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "garantia" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fecha" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neumaticos" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "posicion" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "kmInstalacion" INTEGER NOT NULL DEFAULT 0,
    "kmActual" INTEGER NOT NULL DEFAULT 0,
    "costo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tienda" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Nuevo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "neumaticos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viajes" (
    "id" TEXT NOT NULL,
    "placaTracto" TEXT NOT NULL,
    "carreta" TEXT NOT NULL,
    "conductor" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "operacion" TEXT NOT NULL,
    "contenedor" TEXT NOT NULL,
    "tamanio" TEXT NOT NULL,
    "tipoCarga" TEXT NOT NULL,
    "horaCita" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "devolucion" TEXT NOT NULL,
    "fechaLimite" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Programado',
    "nOrden" TEXT NOT NULL DEFAULT '',
    "greRemitente" TEXT NOT NULL DEFAULT '',
    "greTransporte" TEXT NOT NULL DEFAULT '',
    "factura" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "viajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "ruc" TEXT NOT NULL DEFAULT '-',
    "fecha" DATE NOT NULL,
    "viaje" TEXT NOT NULL DEFAULT '-',
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estadoSunat" TEXT NOT NULL DEFAULT 'Emitida',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "sueldoBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodo" TEXT NOT NULL,
    "estadoPago" TEXT NOT NULL DEFAULT 'Pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_placa_key" ON "vehiculos"("placa");

-- AddForeignKey
ALTER TABLE "documentos_conductor" ADD CONSTRAINT "documentos_conductor_conductorId_fkey" FOREIGN KEY ("conductorId") REFERENCES "conductores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
