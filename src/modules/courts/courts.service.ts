import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Court } from './court.entity';
import { CreateCourtDto } from './dto/create-court.dto';
import { FindCourtsDto } from './dto/find-courts.dto';

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

  async findNearby(dto: FindCourtsDto): Promise<Court[]> {
    const registryClause =
      dto.registryOnly === true ? 'AND is_registry = true' : '';

    if (dto.lat === undefined || dto.lng === undefined) {
      return this.courtRepo.query<Court[]>(
        `SELECT id, name, type, address, created_at, updated_at, is_registry AS "isRegistry",
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng
         FROM courts
         WHERE 1=1 ${registryClause}
         LIMIT 50`,
      );
    }

    const radius = dto.radius ?? 5000;

    return this.courtRepo.query<Court[]>(
      `SELECT id, name, type, address, created_at, updated_at, is_registry AS "isRegistry",
              ST_Y(location::geometry) AS lat,
              ST_X(location::geometry) AS lng,
              ST_Distance(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS distance
       FROM courts
       WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
         ${registryClause}
       ORDER BY distance
       LIMIT 50`,
      [dto.lat, dto.lng, radius],
    );
  }
}
