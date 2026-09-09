import { Module, Injectable, NotFoundException, Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class CreateAgendaDto {
  @IsDateString() fecha: string;
  @IsString() @IsNotEmpty() cliente: string;
  @IsString() @IsOptional() origen?: string;
  @IsString() @IsOptional() devolucion?: string;
  @IsString() @IsOptional() tipoCarga?: string;
  @IsInt() @Min(0) @IsOptional() unidades?: number;
  @IsString() @IsOptional() observacion?: string;
  @IsString() @IsOptional() estado?: string;
}
class UpdateAgendaDto extends PartialType(CreateAgendaDto) {}

function toData(dto: Partial<CreateAgendaDto>) {
  const { fecha, ...rest } = dto;
  const data: any = { ...rest };
  if (fecha !== undefined) data.fecha = new Date(fecha);
  return data;
}

@Injectable()
class AgendaService {
  constructor(private prisma: PrismaService) {}
  findAll(sedeId: string) { return this.prisma.agenda.findMany({ where: { sedeId }, orderBy: { fecha: 'asc' } }); }
  create(sedeId: string, dto: CreateAgendaDto) { return this.prisma.agenda.create({ data: { ...toData(dto), sedeId } as any }); }
  async update(sedeId: string, id: string, dto: UpdateAgendaDto) {
    const a = await this.prisma.agenda.findFirst({ where: { id, sedeId } });
    if (!a) throw new NotFoundException('Servicio no encontrado');
    return this.prisma.agenda.update({ where: { id }, data: toData(dto) });
  }
  async remove(sedeId: string, id: string) {
    const a = await this.prisma.agenda.findFirst({ where: { id, sedeId } });
    if (!a) throw new NotFoundException('Servicio no encontrado');
    return this.prisma.agenda.delete({ where: { id } });
  }
}

@Roles('Administrador', 'Operador')
@Controller('agenda')
class AgendaController {
  constructor(private readonly service: AgendaService) {}
  @Get() findAll(@CurrentUser() u: JwtUser) { return this.service.findAll(u.sedeId); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateAgendaDto) { return this.service.create(u.sedeId, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateAgendaDto) { return this.service.update(u.sedeId, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.remove(u.sedeId, id); }
}

@Module({ controllers: [AgendaController], providers: [AgendaService] })
export class AgendaModule {}
