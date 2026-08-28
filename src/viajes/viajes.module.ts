import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional, IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';
import { ComisionesModule, ComisionesService } from '../comisiones/comisiones.module';

class CreateViajeDto {
  @IsString() @IsNotEmpty({ message: 'La placa del tracto es obligatoria (agrega tractos en Flota).' }) placaTracto: string;
  @IsString() @IsOptional() carreta?: string;
  @IsString() @IsOptional() conductor?: string;
  @IsString() @IsNotEmpty({ message: 'El cliente es obligatorio.' }) cliente: string;
  @IsNumber() @Min(0) @IsOptional() tarifa?: number;
  @IsString() @IsNotEmpty({ message: 'El tipo de operación es obligatorio.' }) operacion: string;
  // El contenedor es opcional: en importación se programa el viaje y se registra al recogerlo (editando).
  @IsString() @IsOptional() contenedor?: string;
  @IsString() @IsOptional() tamanio?: string;
  @IsString() @IsOptional() tipoCarga?: string;
  @IsString() @IsOptional() horaCita?: string;
  @IsDateString() @IsOptional() fechaCliente?: string;
  @IsString() @IsOptional() horaCliente?: string;
  @IsString() @IsOptional() origen?: string;
  @IsString() @IsOptional() destino?: string;
  @IsString() @IsOptional() devolucion?: string;
  @IsString() @IsOptional() ubicacion?: string;
  @IsDateString() @IsOptional() fechaLimite?: string;
  @IsString() @IsOptional() estado?: string;
  @IsString() @IsOptional() nOrden?: string;
  @IsString() @IsOptional() greRemitente?: string;
  @IsString() @IsOptional() greTransporte?: string;
  @IsString() @IsOptional() factura?: string;
}
class UpdateViajeDto extends PartialType(CreateViajeDto) {}

function toData(dto: Partial<CreateViajeDto>) {
  const { fechaLimite, fechaCliente, ...rest } = dto;
  const data: any = { ...rest };
  if (fechaLimite !== undefined) data.fechaLimite = fechaLimite ? new Date(fechaLimite) : null;
  if (fechaCliente !== undefined) data.fechaCliente = fechaCliente ? new Date(fechaCliente) : null;
  return data;
}

@Injectable()
class ViajesService {
  constructor(private prisma: PrismaService, private comisiones: ComisionesService) {}

  findAll(sedeId: string) { return this.prisma.viaje.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' } }); }
  async findOne(sedeId: string, id: string) {
    const v = await this.prisma.viaje.findFirst({ where: { id, sedeId } });
    if (!v) throw new NotFoundException('Viaje no encontrado');
    return v;
  }
  async findByCodigo(sedeId: string, codigo: string) {
    const v = await this.prisma.viaje.findFirst({ where: { sedeId, codigo: codigo.trim().toUpperCase() } });
    if (!v) throw new NotFoundException('No existe un viaje con ese código');
    return v;
  }

  private async nextCodigo(sedeId: string) {
    const last = await this.prisma.viaje.findFirst({ where: { sedeId, codigo: { startsWith: 'OP-' } }, orderBy: { codigo: 'desc' } });
    const n = last?.codigo ? (parseInt(last.codigo.replace('OP-', ''), 10) || 0) + 1 : 1;
    return 'OP-' + String(n).padStart(4, '0');
  }

  async create(sedeId: string, dto: CreateViajeDto) {
    const codigo = await this.nextCodigo(sedeId);
    const cli = await this.prisma.cliente.findFirst({ where: { sedeId, nombre: dto.cliente } });
    const comisionChofer = await this.comisiones.montoPara(sedeId, dto.destino ?? '', dto.tipoCarga ?? '');
    return this.prisma.viaje.create({
      data: { ...toData(dto), sedeId, codigo, clienteRuc: cli?.ruc ?? '', clienteDireccion: cli?.direccion ?? '', comisionChofer, contenedor: dto.contenedor ?? '', origen: dto.origen ?? '', destino: dto.destino ?? '', devolucion: dto.devolucion ?? '' },
    });
  }
  async update(sedeId: string, id: string, dto: UpdateViajeDto) { await this.findOne(sedeId, id); return this.prisma.viaje.update({ where: { id }, data: toData(dto) }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.viaje.delete({ where: { id } }); }
}

@Controller('viajes')
class ViajesController {
  constructor(private readonly service: ViajesService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get('codigo/:codigo') byCodigo(@CurrentUser() u: JwtUser, @Param('codigo') codigo: string) { return this.service.findByCodigo(u.sedeId, codigo); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateViajeDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateViajeDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ imports: [ComisionesModule], controllers: [ViajesController], providers: [ViajesService] })
export class ViajesModule {}
