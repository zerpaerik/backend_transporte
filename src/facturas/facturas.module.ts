import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class CreateFacturaDto {
  @IsString() @IsNotEmpty() serie: string;
  @IsIn(['Factura', 'Boleta', 'N. Crédito']) tipo: string;
  @IsString() @IsNotEmpty() cliente: string;
  @IsString() @IsOptional() ruc?: string;
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
  findAll() { return this.prisma.factura.findMany({ orderBy: { fecha: 'desc' } }); }
  async findOne(id: string) {
    const f = await this.prisma.factura.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Factura no encontrada');
    return f;
  }
  create(dto: CreateFacturaDto) { return this.prisma.factura.create({ data: toData(dto) }); }
  async update(id: string, dto: UpdateFacturaDto) { await this.findOne(id); return this.prisma.factura.update({ where: { id }, data: toData(dto) }); }
  async remove(id: string) { await this.findOne(id); return this.prisma.factura.delete({ where: { id } }); }
}

@Controller('facturas')
class FacturasController {
  constructor(private readonly service: FacturasService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateFacturaDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateFacturaDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [FacturasController], providers: [FacturasService] })
export class FacturasModule {}
