import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.courtsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCourtDto) {
    return this.courtsService.create(dto);
  }
}
