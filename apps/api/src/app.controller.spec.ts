import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('expone la información de la API', () => {
    expect(appController.getInfo()).toEqual({
      name: 'Fogonería API',
      version: '1.0.0',
      docs: '/api/docs',
      health: '/api/v1/health',
    });
  });
});
