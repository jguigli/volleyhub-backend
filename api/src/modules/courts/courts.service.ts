import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Court } from './court.entity';
import { CreateCourtDto } from './dto/create-court.dto';

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
  ) {}

  async create(dto: CreateCourtDto): Promise<Court> {
    const [row] = await this.courtRepo.query<{ id: string }[]>(
      `INSERT INTO courts (name, type, address, location, is_registry)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, false)
       RETURNING id`,
      [dto.name, dto.type, dto.address ?? null, dto.lng, dto.lat],
    );
    if (!row?.id) {
      throw new InternalServerErrorException('Court insert failed');
    }
    return this.findById(row.id);
  }

  async findById(id: string): Promise<Court> {
    const [row] = await this.courtRepo.query<Court[]>(
      `SELECT id, name, type, address, created_at, updated_at, is_registry AS "isRegistry",
              ST_Y(location::geometry) AS lat,
              ST_X(location::geometry) AS lng
       FROM courts WHERE id = $1`,
      [id],
    );
    if (!row) {
      throw new NotFoundException('Court not found');
    }
    return row;
  }

}
