import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AppController } from './app.controller';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { ConductoresModule } from './conductores/conductores.module';
import { OrdenesModule } from './ordenes/ordenes.module';
import { RepuestosModule } from './repuestos/repuestos.module';
import { NeumaticosModule } from './neumaticos/neumaticos.module';
import { ViajesModule } from './viajes/viajes.module';
import { FacturasModule } from './facturas/facturas.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    VehiculosModule,
    ConductoresModule,
    OrdenesModule,
    RepuestosModule,
    NeumaticosModule,
    ViajesModule,
    FacturasModule,
    EmpleadosModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
