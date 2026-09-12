import { Module, Injectable, Controller, Get, Patch, Body } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';
import { MifactConfigService } from './mifact-config.service';
import { MifactClient } from './mifact.client';
import { CorrelativosService } from './correlativos.service';

class UpdateEmisorDto {
  @IsString() @IsOptional() ruc?: string;
  @IsString() @IsOptional() razonSocial?: string;
  @IsString() @IsOptional() nombreComercial?: string;
  @IsString() @IsOptional() ubigeo?: string;
  @IsString() @IsOptional() direccionFiscal?: string;
  @IsString() @IsOptional() codAnexo?: string;
  @IsString() @IsOptional() serieFactura?: string;
  @IsString() @IsOptional() serieBoleta?: string;
  @IsString() @IsOptional() serieNotaCredito?: string;
  @IsString() @IsOptional() puntoVenta?: string;
  @IsString() @IsOptional() ctaDetraccion?: string;
  @IsNumber() @Min(0) @IsOptional() porcDetraccion?: number;
  @IsString() @IsOptional() codDetraccion?: string;
  @IsNumber() @Min(0) @IsOptional() umbralDetraccion?: number;
  @IsString() @IsOptional() correoEnvio?: string;
  @IsBoolean() @IsOptional() activo?: boolean;
}

@Injectable()
class EmisorService {
  constructor(private prisma: PrismaService, private mifact: MifactConfigService) {}

  private ambienteInfo() {
    return { ambiente: this.mifact.ambiente, esProd: this.mifact.esProd, integracionConfigurada: this.mifact.integracionConfigurada };
  }

  // Devuelve la config del emisor de la sede; si no existe, la crea con los datos
  // que ya conocemos de la sede (RUC y razón social).
  async get(sedeId: string) {
    let config = await this.prisma.emisorConfig.findUnique({ where: { sedeId } });
    if (!config) {
      const sede = await this.prisma.sede.findUnique({ where: { id: sedeId }, select: { ruc: true, nombre: true } });
      config = await this.prisma.emisorConfig.create({
        data: { sedeId, ruc: sede?.ruc ?? '', razonSocial: sede?.nombre ?? '' },
      });
    }
    return { config, ...this.ambienteInfo() };
  }

  async update(sedeId: string, dto: UpdateEmisorDto) {
    await this.get(sedeId); // garantiza que exista la fila
    await this.prisma.emisorConfig.update({ where: { sedeId }, data: { ...dto } });
    return this.get(sedeId);
  }
}

@Roles('Administrador')
@Controller('emisor')
class EmisorController {
  constructor(private readonly service: EmisorService) {}
  @Get() get(@CurrentUser() u: JwtUser) { return this.service.get(u.sedeId); }
  @Patch() update(@CurrentUser() u: JwtUser, @Body() dto: UpdateEmisorDto) { return this.service.update(u.sedeId, dto); }
}

@Module({
  controllers: [EmisorController],
  providers: [EmisorService, MifactConfigService, MifactClient, CorrelativosService],
  exports: [MifactConfigService, MifactClient, CorrelativosService],
})
export class FacturacionElectronicaModule {}
