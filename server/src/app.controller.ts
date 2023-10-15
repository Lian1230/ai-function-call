import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return 'hello';
  }

  @Post('/chat')
  chat(@Body() body: any): Promise<string> {
    console.log(body);

    return this.appService.chat({ ...body });
  }
}
