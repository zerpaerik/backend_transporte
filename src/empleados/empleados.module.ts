import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators';

class CreateEmpleadoDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsOptional() cargo?: string;
  @IsIn(['Chofer', 'Administrativo']) tipo: string;
  @IsNumber() @Min(0) @IsOptional() sueldoBase?: number;
  @IsNumber() @Min(0) @IsOptional() bonos?: number;
  @IsNumber() @Min(0) @IsOptional() descuentos?: number;
  @IsString() @IsOptional() periodo?: string;
  @IsIn(['Pendiente', 'Pagado']) @IsOptional() estadoPago?: string;
}
class UpdateEmpleadoDto extends PartialType(CreateEmpleadoDto) {}

@Injectable()
class EmpleadosService {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.empleado.findMany({ orderBy: { createdAt: 'desc' } }); }
  async findOne(id: string) {
    const e = await this.prisma.empleado.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Empleado no encontrado');
    return e;
  }
  create(dto: CreateEmpleadoDto) { return this.prisma.empleado.create({ data: dto as any }); }
  async update(id: string, dto: UpdateEmpleadoDto) { await this.findOne(id); return this.prisma.empleado.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.findOne(id); return this.prisma.empleado.delete({ where: { id } }); }
}

// Módulo de planilla: solo Administrador
@Roles('Administrador')
@Controller('empleados')
class EmpleadosController {
  constructor(private readonly service: EmpleadosService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateEmpleadoDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateEmpleadoDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [EmpleadosController], providers: [EmpleadosService] })
export class EmpleadosModule {}
