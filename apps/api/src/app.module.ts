import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health/health.controller.js';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TenantContextModule } from './common/context/tenant-context.module.js';
import { TenantContextInterceptor } from './common/context/tenant.interceptor.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { SaasModule } from './modules/saas/saas.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { OnboardingModule } from './modules/onboarding/onboarding.module.js';
import { TablesModule } from './modules/tables/tables.module.js';
import { ReservationsModule } from './modules/reservations/reservations.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    TenantContextModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    TenantModule,
    OrdersModule,
    CatalogModule,
    PricingModule,
    SaasModule,
    BillingModule,
    OnboardingModule,
    TablesModule,
    ReservationsModule,
    RealtimeModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
