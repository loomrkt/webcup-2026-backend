import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { success } from './common/api-response';
import type { ApiSuccessResponse } from './common/api-response';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): ApiSuccessResponse<string> {
    return success(this.appService.getHello());
  }
}
