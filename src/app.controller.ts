import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    return { name: 'API Transporte de Carga Pesada', status: 'ok', docs: '/api/health' };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
