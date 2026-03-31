import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CourtsService } from './courts.service';
import { CreateCourtDto } from './dto/create-court.dto';
import { FindCourtsDto } from './dto/find-courts.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get()
  findNearby(@Query() query: FindCourtsDto) {
    return this.courtsService.findNearby(query);
  }

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
