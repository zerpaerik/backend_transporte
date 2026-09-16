import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreateCuentaDto {
  @IsString() @IsNotEmpty() banco: string;
  @IsIn(['Soles', 'Dólares']) @IsOptional() moneda?: string;
  @IsString() @IsNotEmpty() numero: string;
  @IsString() @IsOptional() cci?: string;
  @IsIn(['Corriente', 'Ahorros']) @IsOptional() tipo?: string;
  @IsInt() @IsOptional() orden?: number;
  @IsBoolean() @IsOptional() activo?: boolean;
}
class UpdateCuentaDto extends PartialType(CreateCuentaDto) {}

@Injectable()
class CuentasService {
  constructor(private prisma: PrismaService) {}
  list(sedeId: string) {
    return this.prisma.cuentaBancaria.findMany({ where: { sedeId }, orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
  }
  create(sedeId: string, dto: CreateCuentaDto) {
    return this.prisma.cuentaBancaria.create({ data: { ...dto, sedeId } });
  }
  async update(sedeId: string, id: string, dto: UpdateCuentaDto) {
    const c = await this.prisma.cuentaBancaria.findFirst({ where: { id, sedeId } });
    if (!c) throw new NotFoundException('Cuenta no encontrada');
    return this.prisma.cuentaBancaria.update({ where: { id }, data: dto });
  }
  async remove(sedeId: string, id: string) {
    const c = await this.prisma.cuentaBancaria.findFirst({ where: { id, sedeId } });
    if (!c) throw new NotFoundException('Cuenta no encontrada');
    await this.prisma.cuentaBancaria.delete({ where: { id } });
    return { ok: true };
  }
}

@Roles('Administrador')
@Controller('cuentas-bancarias')
class CuentasController {
  constructor(private readonly service: CuentasService) {}
  @Get() list(@CurrentUser() u: JwtUser) { return this.service.list(u.sedeId); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateCuentaDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateCuentaDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [CuentasController], providers: [CuentasService] })
export class CuentasBancariasModule {}
