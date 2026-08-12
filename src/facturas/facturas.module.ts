import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';

class CreateFacturaDto {
  @IsString() @IsNotEmpty() serie: string;
  @IsIn(['Factura', 'Boleta', 'N. Crédito']) tipo: string;
  @IsString() @IsNotEmpty() cliente: string;
  @IsString() @IsOptional() ruc?: string;
  @IsString() @IsOptional() direccion?: string;
  @IsDateString() fecha: string;
  @IsString() @IsOptional() viaje?: string;
  @IsNumber() @Min(0) monto: number;
  @IsNumber() @Min(0) @IsOptional() igv?: number;
  @IsIn(['Emitida', 'Aceptada', 'Pagada', 'Anulada']) @IsOptional() estadoSunat?: string;
}
class UpdateFacturaDto extends PartialType(CreateFacturaDto) {}

function toData(dto: Partial<CreateFacturaDto>) {
  const { fecha, monto, igv, ...rest } = dto;
  const data: any = { ...rest };
  if (fecha) data.fecha = new Date(fecha);
  if (monto !== undefined) {
    data.monto = monto;
    data.igv = igv !== undefined ? igv : Math.round(monto * 0.18 * 100) / 100;
  } else if (igv !== undefined) {
    data.igv = igv;
  }
  return data;
}

@Injectable()
class FacturasService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.factura.findMany({ where: { sedeId }, orderBy: { fecha: 'desc' } }); }
  async findOne(sedeId: string, id: string) {
    const f = await this.prisma.factura.findFirst({ where: { id, sedeId } });
    if (!f) throw new NotFoundException('Factura no encontrada');
    return f;
  }
  create(sedeId: string, dto: CreateFacturaDto) { return this.prisma.factura.create({ data: { ...toData(dto), sedeId } }); }
  async update(sedeId: string, id: string, dto: UpdateFacturaDto) { await this.findOne(sedeId, id); return this.prisma.factura.update({ where: { id }, data: toData(dto) }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.factura.delete({ where: { id } }); }
}

@Controller('facturas')
class FacturasController {
  constructor(private readonly service: FacturasService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateFacturaDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateFacturaDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [FacturasController], providers: [FacturasService] })
export class FacturasModule {}
