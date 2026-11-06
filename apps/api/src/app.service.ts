import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'Fogonería API',
      version: '1.0.0',
      docs: '/api/docs',
      health: '/api/v1/health',
    };
  }
}
