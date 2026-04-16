import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Match } from '../matches/match.entity';

type ListParams = {
  start?: number;
  end?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
  q?: string;
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
  ) {}

  async getStats() {
    const [totalUsers, totalMatches, openMatches, completedMatches] =
      await Promise.all([
        this.userRepo.count(),
        this.matchRepo.count(),
        this.matchRepo.count({ where: { status: 'open' as any } }),
        this.matchRepo.count({ where: { status: 'completed' as any } }),
      ]);
    return {
      totalUsers,
      totalMatches,
      openMatches,
      completedMatches,
    };
  }

  async listUsers(params: ListParams): Promise<{ data: any[]; total: number }> {
    const start = params.start ?? 0;
    const end = params.end ?? 10;
    const take = Math.max(1, end - start);
    const skip = start;

    const where = params.q
      ? [
          { username: ILike(`%${params.q}%`) },
          { email: ILike(`%${params.q}%`) },
        ]
      : undefined;

    const sortField = params.sort ?? 'createdAt';
    const orderDir = params.order ?? 'DESC';

    const [rows, total] = await this.userRepo.findAndCount({
      where,
      skip,
      take,
      order: { [sortField]: orderDir } as any,
    });

    const data = rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      skillLevel: u.skillLevel,
      position: u.position,
      club: u.club,
      league: u.league,
      createdAt: u.createdAt,
    }));

    return { data, total };
  }

  async getUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    const { passwordHash: _ph, passwordResetToken: _rt, ...rest } = user;
    return rest;
  }

  async listMatches(params: ListParams): Promise<{ data: any[]; total: number }> {
    const start = params.start ?? 0;
    const end = params.end ?? 10;
    const take = Math.max(1, end - start);
    const skip = start;

    const sortField = params.sort ?? 'createdAt';
    const orderDir = params.order ?? 'DESC';

    const [rows, total] = await this.matchRepo.findAndCount({
      relations: ['creator', 'court'],
      skip,
      take,
      order: { [sortField]: orderDir } as any,
    });

    const data = rows.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduledAt,
      status: m.status,
      eventFormat: m.eventFormat,
      volleyType: m.volleyType,
      skillLevel: m.skillLevel,
      maxPlayers: m.maxPlayers,
      currentPlayers: m.currentPlayers,
      creatorUsername: m.creator?.username ?? null,
      courtName: m.court?.name ?? null,
      createdAt: m.createdAt,
    }));

    return { data, total };
  }

  async getMatch(id: string) {
    const match = await this.matchRepo.findOne({
      where: { id },
      relations: ['creator', 'court', 'participants', 'participants.user'],
    });
    if (!match) return null;
    return {
      ...match,
      creatorUsername: match.creator?.username ?? null,
      courtName: match.court?.name ?? null,
    };
  }

  async deleteMatch(id: string): Promise<void> {
    await this.matchRepo.delete(id);
  }
}
