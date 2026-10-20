import { Body, Controller, HttpCode, Ip, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard.js';
import { OnboardingService } from './onboarding.service.js';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto.js';

@ApiTags('onboarding')
@Controller('onboarding')
@UseGuards(RateLimitGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Public()
  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Autoregistro público: crea el lead y la empresa en trial',
  })
  submit(@Body() dto: SubmitOnboardingDto, @Ip() ip: string) {
    return this.onboarding.submit(dto, ip);
  }
}
