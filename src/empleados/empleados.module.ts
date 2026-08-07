import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

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
  findAll(sedeId: string) { return this.prisma.empleado.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' } }); }
  async findOne(sedeId: string, id: string) {
    const e = await this.prisma.empleado.findFirst({ where: { id, sedeId } });
    if (!e) throw new NotFoundException('Empleado no encontrado');
    return e;
  }
  create(sedeId: string, dto: CreateEmpleadoDto) { return this.prisma.empleado.create({ data: { ...dto, sedeId } as any }); }
  async update(sedeId: string, id: string, dto: UpdateEmpleadoDto) { await this.findOne(sedeId, id); return this.prisma.empleado.update({ where: { id }, data: dto }); }
  async remove(sedeId: string, id: string) { await this.findOne(sedeId, id); return this.prisma.empleado.delete({ where: { id } }); }
}

// Módulo de planilla: solo Administrador
@Roles('Administrador')
@Controller('empleados')
class EmpleadosController {
  constructor(private readonly service: EmpleadosService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateEmpleadoDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateEmpleadoDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [EmpleadosController], providers: [EmpleadosService] })
export class EmpleadosModule {}
