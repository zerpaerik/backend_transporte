import { Module, Injectable, Controller, Get, Patch, Body, BadRequestException } from '@nestjs/common';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';
import { MifactConfigService } from './mifact-config.service';
import { MifactClient } from './mifact.client';
import { CorrelativosService } from './correlativos.service';
import { MifactMapper } from './mifact.mapper';
import { GreClient } from './gre.client';
import { GreMapper } from './gre.mapper';

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
  @IsString() @IsOptional() serieGuiaTransportista?: string;
  @IsString() @IsOptional() registroMtc?: string;
  @IsString() @IsOptional() puntoVenta?: string;
  @IsString() @IsOptional() ctaDetraccion?: string;
  @IsNumber() @Min(0) @IsOptional() porcDetraccion?: number;
  @IsString() @IsOptional() codDetraccion?: string;
  @IsNumber() @Min(0) @IsOptional() umbralDetraccion?: number;
  @IsString() @IsOptional() correoEnvio?: string;
  @IsBoolean() @IsOptional() activo?: boolean;
}

class SetCorrelativoDto {
  @IsIn(['01', '03', '07']) tipoDoc: string; // 01 factura · 03 boleta · 07 nota de crédito
  @IsNumber() @Min(1) desde: number; // próximo número a usar
}

const TIPOS_CPE = [
  { tipoDoc: '01', etiqueta: 'Factura' },
  { tipoDoc: '03', etiqueta: 'Boleta' },
  { tipoDoc: '07', etiqueta: 'Nota de crédito' },
];

@Injectable()
class EmisorService {
  constructor(private prisma: PrismaService, private mifact: MifactConfigService, private correlativos: CorrelativosService) {}

  private ambienteInfo() {
    return { ambiente: this.mifact.ambiente, esProd: this.mifact.esProd, integracionConfigurada: this.mifact.integracionConfigurada };
  }

  private seriePorTipo(config: any, tipoDoc: string): string {
    if (tipoDoc === '03') return config.serieBoleta || 'BN01';
    if (tipoDoc === '07') return config.serieNotaCredito || config.serieFactura || 'FN01';
    return config.serieFactura || 'FN01';
  }

  // Próximo correlativo de cada tipo de comprobante (para mostrar y editar en el portal).
  private async correlativosDe(sedeId: string, config: any) {
    return Promise.all(
      TIPOS_CPE.map(async (t) => ({ ...t, serie: this.seriePorTipo(config, t.tipoDoc), siguiente: await this.correlativos.peek(sedeId, t.tipoDoc, this.seriePorTipo(config, t.tipoDoc)) })),
    );
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
    const correlativos = await this.correlativosDe(sedeId, config);
    return { config, correlativos, ...this.ambienteInfo() };
  }

  async update(sedeId: string, dto: UpdateEmisorDto) {
    await this.get(sedeId); // garantiza que exista la fila
    await this.prisma.emisorConfig.update({ where: { sedeId }, data: { ...dto } });
    return this.get(sedeId);
  }

  // Fija desde qué número arranca una serie/tipo. Solo se puede AVANZAR (no bajar),
  // para nunca repetir un correlativo ya emitido.
  async setCorrelativo(sedeId: string, tipoDoc: string, desde: number) {
    const config = await this.prisma.emisorConfig.findUnique({ where: { sedeId } });
    if (!config) throw new BadRequestException('Configura primero los datos del emisor.');
    const serie = this.seriePorTipo(config, tipoDoc);
    const actual = Number(await this.correlativos.peek(sedeId, tipoDoc, serie));
    // En producción el correlativo solo puede avanzar (no repetir números ya emitidos).
    // En demo se permite bajarlo para poder resetear la numeración de las pruebas.
    if (desde < actual && this.mifact.esProd) {
      throw new BadRequestException(`No se puede fijar en ${desde}: la serie ${serie} ya va por ${actual}. En producción el correlativo solo puede avanzar.`);
    }
    await this.correlativos.fijarInicio(sedeId, tipoDoc, serie, desde);
    return this.get(sedeId);
  }
}

@Roles('Administrador')
@Controller('emisor')
class EmisorController {
  constructor(private readonly service: EmisorService) {}
  @Get() get(@CurrentUser() u: JwtUser) { return this.service.get(u.sedeId); }
  @Patch() update(@CurrentUser() u: JwtUser, @Body() dto: UpdateEmisorDto) { return this.service.update(u.sedeId, dto); }
  @Patch('correlativo') setCorrelativo(@CurrentUser() u: JwtUser, @Body() dto: SetCorrelativoDto) { return this.service.setCorrelativo(u.sedeId, dto.tipoDoc, dto.desde); }
}

@Module({
  controllers: [EmisorController],
  providers: [EmisorService, MifactConfigService, MifactClient, CorrelativosService, MifactMapper, GreClient, GreMapper],
  exports: [MifactConfigService, MifactClient, CorrelativosService, MifactMapper, GreClient, GreMapper],
})
export class FacturacionElectronicaModule {}
