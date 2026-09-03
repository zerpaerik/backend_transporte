import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Convierte las fechas puras (@db.Date) a cadenas "YYYY-MM-DD" en las respuestas,
 * para que el frontend las reciba en el mismo formato que usa internamente.
 * Los timestamps createdAt/updatedAt se dejan como ISO completo.
 */
const DATE_ONLY_FIELDS = new Set(['vencimiento', 'fecha', 'fechaLimite', 'semanaDesde', 'semanaHasta', 'citaFecha', 'fechaCliente', 'fechaViaje']);

function transform(value: any): any {
  if (Array.isArray(value)) return value.map(transform);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v instanceof Date && DATE_ONLY_FIELDS.has(k)) {
        out[k] = v.toISOString().slice(0, 10);
      } else {
        out[k] = transform(v);
      }
    }
    return out;
  }
  return value;
}

@Injectable()
export class DateSerializerInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => transform(data)));
  }
}
