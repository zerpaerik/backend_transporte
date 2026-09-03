import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreateCombustibleDto {
  @IsDateString() fecha: string;
  @IsString() @IsNotEmpty() placa: string;
  @IsString() @IsOptional() tipoCombustible?: string;
  @IsNumber() @Min(0) @IsOptional() kilometraje?: number;
  @IsNumber() @Min(0) @IsOptional() galones?: number;
  @IsNumber() @Min(0) @IsOptional() monto?: number;
  @IsString() @IsOptional() tipoPago?: string;
  @IsString() @IsOptional() observacion?: string;
}
class UpdateCombustibleDto extends PartialType(CreateCombustibleDto) {}

function toData(dto: Partial<CreateCombustibleDto>) {
  const { fecha, ...rest } = dto;
  const data: any = { ...rest };
  if (fecha !== undefined) data.fecha = new Date(fecha);
  return data;
}

@Injectable()
class CombustibleService {
  constructor(private prisma: PrismaService) {}

  findAll(sedeId: string) {
    return this.prisma.combustible.findMany({ where: { sedeId }, orderBy: [{ fecha: 'desc' }, { kilometraje: 'desc' }] });
  }
  async findOne(sedeId: string, id: string) {
    const c = await this.prisma.combustible.findFirst({ where: { id, sedeId } });
    if (!c) throw new NotFoundException('Registro de combustible no encontrado');
    return c;
  }
  create(sedeId: string, dto: CreateCombustibleDto) {
    return this.prisma.combustible.create({ data: { ...toData(dto), sedeId } as any });
  }
  async update(sedeId: string, id: string, dto: UpdateCombustibleDto) {
    await this.findOne(sedeId, id);
    return this.prisma.combustible.update({ where: { id }, data: toData(dto) });
  }
  async remove(sedeId: string, id: string) {
    await this.findOne(sedeId, id);
    await this.prisma.combustible.delete({ where: { id } });
    return { ok: true };
  }
}

@Roles('Administrador', 'Operador', 'Mecánico')
@Controller('combustible')
class CombustibleController {
  constructor(private readonly service: CombustibleService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Get(':id') findOne(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.findOne(u.sedeId, id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateCombustibleDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateCombustibleDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [CombustibleController], providers: [CombustibleService] })
export class CombustibleModule {}
