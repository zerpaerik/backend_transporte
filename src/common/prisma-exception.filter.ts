import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Traduce errores conocidos de Prisma a respuestas HTTP claras
// (evita los 500 genéricos ante duplicados / no encontrado).
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception.code === 'P2002') {
      // Violación de restricción única
      const campos = (exception.meta?.target as string[]) || [];
      const esPlaca = campos.includes('placa');
      const msg = esPlaca
        ? 'Ya existe un vehículo con esa placa en esta sede.'
        : 'Ya existe un registro con ese valor único.';
      return res.status(HttpStatus.CONFLICT).json({ statusCode: HttpStatus.CONFLICT, error: 'Conflict', message: msg });
    }

    if (exception.code === 'P2025') {
      return res.status(HttpStatus.NOT_FOUND).json({ statusCode: HttpStatus.NOT_FOUND, error: 'Not Found', message: 'Registro no encontrado.' });
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, error: 'Internal Server Error', message: 'Error de base de datos.' });
  }
}
