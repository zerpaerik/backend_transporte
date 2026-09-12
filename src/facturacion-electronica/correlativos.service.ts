import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Numeración de comprobantes por (sede, tipo de documento, serie).
 * El sistema controla el correlativo en transacción para no duplicar ni saltar
 * números. Se guarda "siguiente" = el próximo número a usar.
 */
@Injectable()
export class CorrelativosService {
  constructor(private readonly prisma: PrismaService) {}

  private fmt(n: number): string {
    return String(n).padStart(8, '0'); // SUNAT: correlativo de hasta 8 dígitos
  }

  /**
   * Reserva atómicamente el siguiente correlativo y lo devuelve formateado a 8
   * dígitos. Usar justo antes de emitir; si la emisión falla de forma definitiva,
   * el número reservado se considera consumido (SUNAT no permite reutilizar).
   */
  async reservar(sedeId: string, tipoDoc: string, serie: string): Promise<string> {
    const reservado = await this.prisma.$transaction(async (tx) => {
      const row = await tx.correlativo.upsert({
        where: { sedeId_tipoDoc_serie: { sedeId, tipoDoc, serie } },
        create: { sedeId, tipoDoc, serie, siguiente: 2 }, // se reserva el 1, el próximo será el 2
        update: { siguiente: { increment: 1 } },
      });
      return row.siguiente - 1;
    });
    return this.fmt(reservado);
  }

  /** Próximo número sin reservarlo (para previsualizar en la UI). Si no existe, es 1. */
  async peek(sedeId: string, tipoDoc: string, serie: string): Promise<string> {
    const row = await this.prisma.correlativo.findUnique({
      where: { sedeId_tipoDoc_serie: { sedeId, tipoDoc, serie } },
    });
    return this.fmt(row?.siguiente ?? 1);
  }

  /**
   * Fija desde qué número arranca una serie (p. ej. al pasar a producción, para no
   * pisar numeración previa emitida por otra vía). "desde" es el próximo a usar.
   */
  async fijarInicio(sedeId: string, tipoDoc: string, serie: string, desde: number): Promise<string> {
    const siguiente = Math.max(1, Math.floor(desde));
    const row = await this.prisma.correlativo.upsert({
      where: { sedeId_tipoDoc_serie: { sedeId, tipoDoc, serie } },
      create: { sedeId, tipoDoc, serie, siguiente },
      update: { siguiente },
    });
    return this.fmt(row.siguiente);
  }
}
