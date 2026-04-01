import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventFormat, TournamentSystem, VolleyType } from '../../common/enums';
import { UpdateMatchManageDto } from './dto/update-match-manage.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from './match.entity';
import { MatchParticipant } from './match-participant.entity';
import { MatchChatMute } from './match-chat-mute.entity';
import { CreateMatchDto } from './dto/create-match.dto';
import { FindMatchesDto } from './dto/find-matches.dto';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MatchesGateway } from './matches.gateway';
import {
  FixtureStatus,
  TournamentFixtureMatch,
} from './tournament-fixture.entity';
import { TournamentGeneratorService } from './tournament-generator.service';
import { TournamentEngineService } from './tournament-engine.service';
import { User } from '../users/user.entity';

const NEARBY_MATCHES_TTL = 60; // seconds
const INVITES_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type EventInviteItem = {
  id: string;
  matchId: string;
  inviterId: string;
  inviterUsername: string;
  eventFormat: EventFormat;
  title: string;
  body: string;
  createdAt: string;
};

type SentInviteState = {
  userIds: string[];
};

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(MatchParticipant)
    private readonly participantRepo: Repository<MatchParticipant>,
    @InjectRepository(MatchChatMute)
    private readonly chatMuteRepo: Repository<MatchChatMute>,
    @InjectRepository(TournamentFixtureMatch)
    private readonly fixtureRepo: Repository<TournamentFixtureMatch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
    private readonly tournamentGenerator: TournamentGeneratorService,
    private readonly tournamentEngine: TournamentEngineService,
    @Inject(forwardRef(() => MatchesGateway))
    private readonly matchesGateway: MatchesGateway,
  ) {}

  private allowedMaxPlayersForVolley(volley: VolleyType): Set<number> {
    if (volley === VolleyType.BEACH) {
      return new Set([4, 6, 8]);
    }
    return new Set([4, 6, 8, 12]);
  }

  private readonly allowedMatchSets = new Set([2, 3, 5]);
  private readonly allowedPointsToWin = new Set([15, 21, 25]);

  async create(creatorId: string, dto: CreateMatchDto): Promise<Match> {
    const format =
      dto.eventFormat === EventFormat.TOURNAMENT
        ? EventFormat.TOURNAMENT
        : EventFormat.MATCH;

    let maxPlayers: number;
    let teamCount: number | null = null;
    let teamSize: number | null = null;
    let matchSets: number | null = null;
    let pointsToWin: number | null = null;
    let tournamentPointsPerMatch: number | null = null;
    let tournamentCourtCount: number | null = null;
    let tournamentSystem: TournamentSystem | null = null;

    if (format === EventFormat.TOURNAMENT) {
      if (dto.teamCount == null || dto.teamSize == null) {
        throw new BadRequestException(
          'Tournament requires teamCount and teamSize',
        );
      }
      if (dto.tournamentPointsPerMatch == null) {
        throw new BadRequestException(
          'tournamentPointsPerMatch is required for a tournament',
        );
      }
      if (dto.tournamentCourtCount == null) {
        throw new BadRequestException(
          'tournamentCourtCount is required for a tournament',
        );
      }
      if (dto.tournamentCourtCount < 1 || dto.tournamentCourtCount > 16) {
        throw new BadRequestException('Invalid tournamentCourtCount');
      }
      if (dto.tournamentSystem == null) {
        throw new BadRequestException('tournamentSystem is required for a tournament');
      }
      if (!this.allowedPointsToWin.has(dto.tournamentPointsPerMatch)) {
        throw new BadRequestException('Invalid tournamentPointsPerMatch');
      }
      teamCount = dto.teamCount;
      teamSize = dto.teamSize;
      tournamentPointsPerMatch = dto.tournamentPointsPerMatch;
      tournamentCourtCount = dto.tournamentCourtCount;
      tournamentSystem = dto.tournamentSystem;
      if (dto.volleyType === VolleyType.BEACH && teamSize > 4) {
        throw new BadRequestException(
          'Beach tournament: at most 4 players per team',
        );
      }
      maxPlayers = teamCount * teamSize;
      if (maxPlayers < 4 || maxPlayers > 96) {
        throw new BadRequestException('Invalid tournament capacity');
      }
    } else {
      if (dto.maxPlayers == null) {
        throw new BadRequestException('maxPlayers is required for a match');
      }
      if (dto.matchSets == null || dto.pointsToWin == null) {
        throw new BadRequestException(
          'matchSets and pointsToWin are required for a match',
        );
      }
      if (!this.allowedMatchSets.has(dto.matchSets)) {
        throw new BadRequestException('Invalid matchSets');
      }
      if (!this.allowedPointsToWin.has(dto.pointsToWin)) {
        throw new BadRequestException('Invalid pointsToWin');
      }
      const allowed = this.allowedMaxPlayersForVolley(dto.volleyType);
      if (!allowed.has(dto.maxPlayers)) {
        throw new BadRequestException('maxPlayers is not allowed for this volley type');
      }
      maxPlayers = dto.maxPlayers;
      matchSets = dto.matchSets;
      pointsToWin = dto.pointsToWin;
    }

    const match = this.matchRepo.create({
      courtId: dto.courtId,
      creatorId,
      scheduledAt: new Date(dto.scheduledAt),
      maxPlayers,
      currentPlayers: 1,
      skillLevel: dto.skillLevel,
      volleyType: dto.volleyType,
      eventFormat: format,
      teamCount,
      teamSize,
      matchSets,
      pointsToWin,
      tournamentPointsPerMatch,
      tournamentCourtCount,
      tournamentSystem,
      description: dto.description ?? null,
    });

    const saved = await this.matchRepo.save(match);

    // Creator auto-joins (insert explicite : évite match_id null avec save plain object)
    await this.participantRepo.insert({
      matchId: saved.id,
      userId: creatorId,
    });

    await this.redisService.set(
      `match:${saved.id}:count`,
      '1',
      NEARBY_MATCHES_TTL * 60,
    );

    await this.invalidateNearbyCache();

    if (
      format === EventFormat.TOURNAMENT &&
      tournamentSystem != null &&
      teamCount != null &&
      tournamentPointsPerMatch != null &&
      tournamentCourtCount != null
    ) {
      await this.seedTournamentFixturesForNewMatch(
        saved.id,
        tournamentSystem,
        teamCount,
        tournamentPointsPerMatch,
        tournamentCourtCount,
      );
    }

    const created = await this.findById(saved.id);
    if (format === EventFormat.TOURNAMENT) {
      this.matchesGateway.broadcastMatchUpdate(created.id, {
        matchId: created.id,
        currentPlayers: created.currentPlayers,
        maxPlayers: created.maxPlayers,
        status: created.status,
        courtId: created.courtId,
        tournamentStateUpdated: true,
      });
    }
    return created;
  }

  async findById(id: string): Promise<Match> {
    const match = await this.matchRepo.findOne({
      where: { id },
      relations: ['court', 'creator', 'participants', 'participants.user'],
    });
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    await this.attachCourtLatLng(match);
    await this.attachTournamentData(match);
    return match;
  }

  /** Court entity has geography `location` only; API consumers need lat/lng for display. */
  private async attachCourtLatLng(match: Match): Promise<void> {
    if (!match.court?.id) {
      return;
    }
    const rows = (await this.matchRepo.query(
      `SELECT ST_Y(location::geometry)::double precision AS lat,
              ST_X(location::geometry)::double precision AS lng
       FROM courts WHERE id = $1`,
      [match.court.id],
    )) as { lat: number | null; lng: number | null }[];
    const r = rows[0];
    if (!r) {
      return;
    }
    Object.assign(match.court, {
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
    });
  }

  async findNearby(dto: FindMatchesDto): Promise<unknown[]> {
    const cacheKey = `nearby:matches:v2:${dto.lat ?? 'all'}:${dto.lng ?? 'all'}:${dto.radius ?? 10000}:${dto.skillLevel ?? 'all'}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as unknown[];
    }

    let query = `
      SELECT m.id, m.scheduled_at, m.max_players, m.current_players,
             m.skill_level, m.status, m.description, m.created_at,
             m.volley_type AS volley_type,
             m.event_format AS event_format,
             m.match_sets AS match_sets,
             m.points_to_win AS points_to_win,
             m.tournament_points_per_match AS tournament_points_per_match,
             c.id AS court_id, c.name AS court_name, c.type AS court_type,
             c.address AS court_address,
             COALESCE(c.is_registry, true) AS court_is_registry,
             ST_Y(c.location::geometry) AS court_lat,
             ST_X(c.location::geometry) AS court_lng,
             u.id AS creator_id, u.username AS creator_username,
             u.profile_picture AS creator_picture
      FROM matches m
      JOIN courts c ON c.id = m.court_id
      JOIN users u ON u.id = m.creator_id
      WHERE m.status IN ('open', 'full')
    `;

    const params: (string | number)[] = [];

    if (dto.skillLevel) {
      params.push(dto.skillLevel);
      query += ` AND m.skill_level = $${params.length}`;
    }

    if (dto.lat !== undefined && dto.lng !== undefined) {
      const radius = dto.radius ?? 10000;
      params.push(dto.lat, dto.lng, radius);
      query += ` AND ST_DWithin(c.location, ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length - 2}), 4326)::geography, $${params.length})`;
      query += ` ORDER BY ST_Distance(c.location, ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length - 2}), 4326)::geography)`;
    } else {
      query += ` ORDER BY m.scheduled_at`;
    }

    query += ` LIMIT 50`;

    const rows = await this.matchRepo.query(query, params);

    await this.redisService.set(
      cacheKey,
      JSON.stringify(rows),
      NEARBY_MATCHES_TTL,
    );

    return rows as unknown[];
  }

  async getSuggestions(
    userId: string,
    dto: FindMatchesDto,
  ): Promise<unknown[]> {
    const userResult = await this.matchRepo.query(
      `SELECT skill_level FROM users WHERE id = $1`,
      [userId],
    ) as { skill_level: string }[];

    const userSkill = userResult[0]?.skill_level ?? dto.skillLevel;
    return this.findNearby({ ...dto, skillLevel: userSkill as FindMatchesDto['skillLevel'] });
  }

  async join(matchId: string, userId: string): Promise<Match> {
    const match = await this.findById(matchId);

    if (match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Match is cancelled');
    }

    if (match.status === MatchStatus.COMPLETED) {
      throw new BadRequestException('Match is completed');
    }

    if (match.status !== MatchStatus.OPEN && match.status !== MatchStatus.FULL) {
      throw new BadRequestException('Match is not open');
    }

    if (match.status === MatchStatus.FULL || match.currentPlayers >= match.maxPlayers) {
      throw new BadRequestException('Match is full');
    }

    const existing = await this.participantRepo.findOne({
      where: { matchId, userId },
    });
    if (existing) {
      throw new BadRequestException('Already joined this match');
    }

    await this.participantRepo.insert({ matchId, userId });

    match.currentPlayers += 1;

    if (match.currentPlayers >= match.maxPlayers) {
      match.status = MatchStatus.FULL;
    }

    await this.matchRepo.update(matchId, {
      currentPlayers: match.currentPlayers,
      status: match.status,
    });

    await this.redisService.set(
      `match:${matchId}:count`,
      String(match.currentPlayers),
      NEARBY_MATCHES_TTL * 60,
    );

    await this.invalidateNearbyCache();

    // Notify creator
    await this.notificationsService.notifyPlayerJoined(match, userId);

    // Notify all if almost full (>= 80%)
    if (match.currentPlayers / match.maxPlayers >= 0.8) {
      await this.notificationsService.notifyMatchAlmostFull(match);
    }

    return this.findById(matchId);
  }

  async invitePlayer(
    matchId: string,
    inviterUserId: string,
    invitedUserId: string,
  ): Promise<{ ok: true }> {
    const match = await this.findById(matchId);
    if (match.status !== MatchStatus.OPEN) {
      throw new BadRequestException('Invites are allowed only while event is open');
    }
    if (match.currentPlayers >= match.maxPlayers) {
      throw new BadRequestException('Event is full');
    }
    const inviterIsParticipant = match.participants.some((p) => p.userId === inviterUserId);
    if (!inviterIsParticipant) {
      throw new ForbiddenException('Only registered players can invite');
    }
    if (invitedUserId === inviterUserId) {
      throw new BadRequestException('Cannot invite yourself');
    }
    const invitedAlreadyIn = match.participants.some((p) => p.userId === invitedUserId);
    if (invitedAlreadyIn) {
      throw new BadRequestException('User is already in this event');
    }
    const invited = await this.userRepo.findOne({ where: { id: invitedUserId } });
    if (!invited) {
      throw new NotFoundException('User not found');
    }
    const inviter = await this.userRepo.findOne({ where: { id: inviterUserId } });
    const inviteItem: EventInviteItem = {
      id: randomUUID(),
      matchId: match.id,
      inviterId: inviterUserId,
      inviterUsername: inviter?.username ?? 'A player',
      eventFormat: match.eventFormat,
      title: 'Event invitation',
      body: `${inviter?.username ?? 'A player'} invited you to join an event.`,
      createdAt: new Date().toISOString(),
    };
    const alreadyInvited = await this.isAlreadyInvited(match.id, inviterUserId, invitedUserId);
    if (!alreadyInvited) {
      await this.pushIncomingInvite(invitedUserId, inviteItem);
      await this.markSentInvite(match.id, inviterUserId, invitedUserId);
      await this.notificationsService.notifyInvitedToMatch(
        match.id,
        invitedUserId,
        inviter?.username ?? 'A player',
      );
    }
    return { ok: true };
  }

  async getIncomingInvites(userId: string): Promise<EventInviteItem[]> {
    const raw = await this.redisService.get(`invites:user:${userId}`);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as EventInviteItem[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } catch {
      return [];
    }
  }

  async dismissIncomingInvite(userId: string, inviteId: string): Promise<{ ok: true }> {
    const current = await this.getIncomingInvites(userId);
    const dismissed = current.find((x) => x.id === inviteId);
    const next = current.filter((x) => x.id !== inviteId);
    await this.redisService.set(
      `invites:user:${userId}`,
      JSON.stringify(next),
      INVITES_TTL_SECONDS,
    );
    if (dismissed) {
      await this.unmarkSentInvite(dismissed.matchId, dismissed.inviterId, userId);
    }
    return { ok: true };
  }

  private async pushIncomingInvite(userId: string, invite: EventInviteItem): Promise<void> {
    const current = await this.getIncomingInvites(userId);
    const alreadyExists = current.some(
      (x) => x.matchId === invite.matchId && x.inviterId === invite.inviterId,
    );
    if (alreadyExists) {
      return;
    }
    const next = [invite, ...current].slice(0, 100);
    await this.redisService.set(
      `invites:user:${userId}`,
      JSON.stringify(next),
      INVITES_TTL_SECONDS,
    );
  }

  async getSentInviteUserIds(matchId: string, inviterUserId: string): Promise<string[]> {
    const raw = await this.redisService.get(`invites:sent:${matchId}:${inviterUserId}`);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as SentInviteState;
      if (!parsed || !Array.isArray(parsed.userIds)) {
        return [];
      }
      return parsed.userIds;
    } catch {
      return [];
    }
  }

  private async isAlreadyInvited(
    matchId: string,
    inviterUserId: string,
    invitedUserId: string,
  ): Promise<boolean> {
    const sent = await this.getSentInviteUserIds(matchId, inviterUserId);
    return sent.includes(invitedUserId);
  }

  private async markSentInvite(
    matchId: string,
    inviterUserId: string,
    invitedUserId: string,
  ): Promise<void> {
    const key = `invites:sent:${matchId}:${inviterUserId}`;
    const current = await this.getSentInviteUserIds(matchId, inviterUserId);
    if (current.includes(invitedUserId)) {
      return;
    }
    await this.redisService.set(
      key,
      JSON.stringify({ userIds: [...current, invitedUserId] } satisfies SentInviteState),
      INVITES_TTL_SECONDS,
    );
  }

  private async unmarkSentInvite(
    matchId: string,
    inviterUserId: string,
    invitedUserId: string,
  ): Promise<void> {
    const key = `invites:sent:${matchId}:${inviterUserId}`;
    const current = await this.getSentInviteUserIds(matchId, inviterUserId);
    if (!current.includes(invitedUserId)) {
      return;
    }
    const next = current.filter((id) => id !== invitedUserId);
    await this.redisService.set(
      key,
      JSON.stringify({ userIds: next } satisfies SentInviteState),
      INVITES_TTL_SECONDS,
    );
  }

  async leave(matchId: string, userId: string): Promise<Match> {
    const match = await this.findById(matchId);

    if (match.creatorId === userId) {
      throw new ForbiddenException('Creator cannot leave their own match');
    }

    const participant = await this.participantRepo.findOne({
      where: { matchId, userId },
    });

    if (!participant) {
      throw new BadRequestException('Not a participant of this match');
    }

    await this.participantRepo.remove(participant);

    const nextCount = Math.max(0, match.currentPlayers - 1);
    const nextStatus =
      match.status === MatchStatus.FULL ? MatchStatus.OPEN : match.status;

    await this.matchRepo.update(matchId, {
      currentPlayers: nextCount,
      status: nextStatus,
    });

    await this.redisService.set(
      `match:${matchId}:count`,
      String(nextCount),
      NEARBY_MATCHES_TTL * 60,
    );

    await this.invalidateNearbyCache();

    return this.findById(matchId);
  }

  async getUserMatchStats(userId: string): Promise<{
    played: number;
    created: number;
    upcoming: number;
    wins: number;
    losses: number;
    winRate: number;
    streak: number;
  }> {
    return this.getUserMatchStatsByFormat(userId);
  }

  async getUserMatchStatsByFormat(
    userId: string,
    eventFormat?: EventFormat,
  ): Promise<{
    played: number;
    created: number;
    upcoming: number;
    wins: number;
    losses: number;
    winRate: number;
    streak: number;
  }> {
    const [row] = (await this.matchRepo.query(
      `
      WITH um AS (
        SELECT m.id, m.scheduled_at, m.creator_id, m.status
        FROM matches m
        WHERE (
          m.creator_id = $1
          OR EXISTS (
            SELECT 1 FROM match_participants mp
            WHERE mp.match_id = m.id AND mp.user_id = $1
          )
        )
          AND ($2::text IS NULL OR m.event_format::text = $2::text)
      )
      SELECT
        COALESCE((
          SELECT COUNT(*)::int FROM um
          WHERE status = 'completed'
        ), 0) AS played,
        COALESCE((SELECT COUNT(*)::int FROM um WHERE creator_id = $1), 0) AS created,
        COALESCE((SELECT COUNT(*)::int FROM um WHERE status IN ('open','full')), 0) AS upcoming
      `,
      [userId, eventFormat ?? null],
    )) as {
      played: number;
      created: number;
      upcoming: number;
    }[];

    const completedRows = (await this.matchRepo.query(
      `
      SELECT
        m.id,
        m.event_format AS "eventFormat",
        m.scheduled_at AS "scheduledAt",
        m.team_a_score AS "teamAScore",
        m.team_b_score AS "teamBScore",
        m.tournament_games AS "tournamentGames",
        mp.team_index AS "myTeamIndex"
      FROM matches m
      LEFT JOIN match_participants mp
        ON mp.match_id = m.id
       AND mp.user_id = $1
      WHERE (m.creator_id = $1 OR mp.user_id = $1)
        AND m.status = 'completed'
        AND ($2::text IS NULL OR m.event_format::text = $2::text)
      ORDER BY m.scheduled_at DESC
      `,
      [userId, eventFormat ?? null],
    )) as {
      id: string;
      eventFormat: EventFormat;
      scheduledAt: string;
      teamAScore: number | null;
      teamBScore: number | null;
      tournamentGames:
        | {
            teamAIndex: number;
            teamBIndex: number;
            scoreA: number;
            scoreB: number;
          }[]
        | null;
      myTeamIndex: number | null;
    }[];

    const eventOutcome = (match: (typeof completedRows)[number]): 'win' | 'loss' | null => {
      if (match.myTeamIndex == null) return null;
      if (match.eventFormat === EventFormat.MATCH) {
        if (match.teamAScore == null || match.teamBScore == null) return null;
        if (match.myTeamIndex === 0) {
          if (match.teamAScore > match.teamBScore) return 'win';
          if (match.teamAScore < match.teamBScore) return 'loss';
          return null;
        }
        if (match.myTeamIndex === 1) {
          if (match.teamBScore > match.teamAScore) return 'win';
          if (match.teamBScore < match.teamAScore) return 'loss';
          return null;
        }
        return null;
      }

      const games = Array.isArray(match.tournamentGames) ? match.tournamentGames : [];
      let gameWins = 0;
      let gameLosses = 0;
      for (const g of games) {
        if (g.teamAIndex === match.myTeamIndex) {
          if (g.scoreA > g.scoreB) gameWins += 1;
          else if (g.scoreA < g.scoreB) gameLosses += 1;
        } else if (g.teamBIndex === match.myTeamIndex) {
          if (g.scoreB > g.scoreA) gameWins += 1;
          else if (g.scoreB < g.scoreA) gameLosses += 1;
        }
      }
      if (gameWins > gameLosses) return 'win';
      if (gameLosses > gameWins) return 'loss';
      return null;
    };

    let wins = 0;
    let losses = 0;
    for (const match of completedRows) {
      const outcome = eventOutcome(match);
      if (outcome === 'win') wins += 1;
      if (outcome === 'loss') losses += 1;
    }

    let streak = 0;
    for (const match of completedRows) {
      const outcome = eventOutcome(match);
      if (outcome == null) continue;
      if (outcome === 'win') {
        streak += 1;
        continue;
      }
      break;
    }

    const decided = wins + losses;
    const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;

    return {
      played: row?.played ?? 0,
      created: row?.created ?? 0,
      upcoming: row?.upcoming ?? 0,
      wins,
      losses,
      winRate,
      streak,
    };
  }

  async getMyMatches(userId: string): Promise<unknown[]> {
    const rows = await this.matchRepo.query(
      `
      SELECT m.id, m.scheduled_at, m.max_players,
             COALESCE((
               SELECT COUNT(*)::int
               FROM match_participants mp_count
               WHERE mp_count.match_id = m.id
             ), 0) AS current_players,
             m.skill_level, m.status, m.description, m.created_at,
             m.volley_type AS volley_type,
             m.event_format AS event_format,
             m.match_sets AS match_sets,
             m.points_to_win AS points_to_win,
             m.tournament_points_per_match AS tournament_points_per_match,
             m.creator_id,
             u.username AS creator_username,
             c.id AS court_id, c.name AS court_name, c.type AS court_type,
             c.address AS court_address,
             COALESCE(c.is_registry, true) AS court_is_registry,
             ST_Y(c.location::geometry) AS court_lat,
             ST_X(c.location::geometry) AS court_lng
      FROM matches m
      JOIN courts c ON c.id = m.court_id
      JOIN users u ON u.id = m.creator_id
      WHERE m.creator_id = $1
         OR EXISTS (
           SELECT 1 FROM match_participants mp
           WHERE mp.match_id = m.id AND mp.user_id = $1
         )
      ORDER BY m.scheduled_at DESC
      LIMIT 50
      `,
      [userId],
    );
    return rows as unknown[];
  }

  async getPlayerCount(matchId: string): Promise<number> {
    const cached = await this.redisService.get(`match:${matchId}:count`);
    if (cached !== null) {
      return parseInt(cached, 10);
    }
    const match = await this.findById(matchId);
    return match.currentPlayers;
  }

  async updateManage(
    matchId: string,
    userId: string,
    dto: UpdateMatchManageDto,
  ): Promise<Match> {
    const match = await this.findById(matchId);

    if (match.creatorId !== userId) {
      throw new ForbiddenException('Only the organizer can update this match');
    }
    if (match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Match is cancelled');
    }

    if (dto.teamAssignments != null) {
      const participantIds = new Set(match.participants.map((p) => p.userId));
      if (match.eventFormat === EventFormat.TOURNAMENT) {
        const n = match.teamCount;
        const size = match.teamSize;
        if (n == null || size == null) {
          throw new BadRequestException('Invalid tournament configuration');
        }
        const nextTeamByUser = new Map<string, number | null>();
        for (const p of match.participants) {
          nextTeamByUser.set(p.userId, p.teamIndex ?? null);
        }
        for (const [assignUserId, idx] of Object.entries(dto.teamAssignments)) {
          if (!participantIds.has(assignUserId)) {
            throw new BadRequestException(
              'All assigned users must be participants',
            );
          }
          if (
            idx !== null &&
            (typeof idx !== 'number' ||
              !Number.isInteger(idx) ||
              idx < 0 ||
              idx >= n)
          ) {
            throw new BadRequestException('Invalid team index for tournament');
          }
          nextTeamByUser.set(assignUserId, idx);
        }
        const counts = new Array<number>(n).fill(0);
        for (const ti of nextTeamByUser.values()) {
          if (ti !== null && ti !== undefined) {
            counts[ti] += 1;
          }
        }
        for (let t = 0; t < n; t += 1) {
          if (counts[t] > size) {
            throw new BadRequestException(
              `A team cannot have more than ${size} players`,
            );
          }
        }
        for (const [assignUserId, idx] of Object.entries(dto.teamAssignments)) {
          await this.participantRepo.update(
            { matchId, userId: assignUserId },
            { teamIndex: idx === null ? null : idx },
          );
        }
      } else {
        for (const [assignUserId, idx] of Object.entries(dto.teamAssignments)) {
          if (!participantIds.has(assignUserId)) {
            throw new BadRequestException(
              'All assigned users must be participants',
            );
          }
          if (idx !== null && idx !== 0 && idx !== 1) {
            throw new BadRequestException('teamIndex must be 0, 1, or null');
          }
          await this.participantRepo.update(
            { matchId, userId: assignUserId },
            { teamIndex: idx === null ? null : idx },
          );
        }
      }
    }

    let needsMatchSave = false;
    if (dto.setScores !== undefined) {
      if (match.eventFormat === EventFormat.TOURNAMENT) {
        throw new BadRequestException(
          'Set scores are only for standard matches',
        );
      }
      if (dto.setScores === null) {
        match.setScores = null;
        match.teamAScore = null;
        match.teamBScore = null;
        match.status = this.statusByCapacity(match);
      } else {
        const maxSetPoints = Math.max(1, match.pointsToWin ?? 21);
        const totalSets = Math.max(1, match.matchSets ?? 3);
        const setsToWin = Math.floor(totalSets / 2) + 1;
        const normalized = dto.setScores.map((s) => ({
          teamA: Number(s.teamA),
          teamB: Number(s.teamB),
        }));
        if (normalized.length > totalSets) {
          throw new BadRequestException(
            `Too many sets provided: maximum is ${totalSets}`,
          );
        }
        let winsA = 0;
        let winsB = 0;
        for (const s of normalized) {
          if (
            !Number.isFinite(s.teamA) ||
            !Number.isFinite(s.teamB) ||
            !Number.isInteger(s.teamA) ||
            !Number.isInteger(s.teamB) ||
            s.teamA < 0 ||
            s.teamB < 0 ||
            s.teamA > maxSetPoints ||
            s.teamB > maxSetPoints
          ) {
            throw new BadRequestException(
              `Set scores must be integers between 0 and ${maxSetPoints}`,
            );
          }
          if (s.teamA > s.teamB) winsA += 1;
          if (s.teamB > s.teamA) winsB += 1;
        }
        match.setScores = normalized;
        match.teamAScore = winsA;
        match.teamBScore = winsB;
        const hasWinner = winsA >= setsToWin || winsB >= setsToWin;
        match.status = hasWinner
          ? MatchStatus.COMPLETED
          : this.statusByCapacity(match);
      }
      needsMatchSave = true;
    }

    if (dto.tournamentGames !== undefined) {
      if (match.eventFormat !== EventFormat.TOURNAMENT) {
        throw new BadRequestException(
          'Tournament games only apply to tournaments',
        );
      }
      const n = match.teamCount;
      if (n == null) {
        throw new BadRequestException('Invalid tournament');
      }
      if (dto.tournamentGames === null) {
        await this.fixtureRepo.delete({ eventMatchId: matchId });
        match.tournamentGames = null;
        needsMatchSave = true;
      } else {
        await this.ensureTournamentFixturesFromLegacy(match);
        const fixtures = await this.fixtureRepo.find({
          where: { eventMatchId: matchId },
          order: { round: 'ASC', order: 'ASC' },
        });
        const courts = match.tournamentCourtCount ?? 1;
        const pts = match.tournamentPointsPerMatch ?? 21;

        if (fixtures.length === 0) {
          for (const g of dto.tournamentGames) {
            if (
              g.teamAIndex < 0 ||
              g.teamAIndex >= n ||
              g.teamBIndex < 0 ||
              g.teamBIndex >= n ||
              g.teamAIndex === g.teamBIndex
            ) {
              throw new BadRequestException('Invalid tournament game');
            }
            const ci = g.courtIndex ?? 0;
            if (ci < 0 || ci >= courts) {
              throw new BadRequestException('Invalid tournament game courtIndex');
            }
          }
          match.tournamentGames = dto.tournamentGames.map((x, idx) => ({
            teamAIndex: x.teamAIndex,
            teamBIndex: x.teamBIndex,
            scoreA: x.scoreA,
            scoreB: x.scoreB,
            courtIndex: x.courtIndex ?? 0,
            round: x.round ?? 0,
            order: x.order ?? idx,
          }));
          const allDone =
            dto.tournamentGames.length > 0 &&
            dto.tournamentGames.every(
              (g) =>
                Number.isFinite(g.scoreA) &&
                Number.isFinite(g.scoreB) &&
                g.scoreA !== g.scoreB &&
                (g.scoreA >= pts || g.scoreB >= pts),
            );
          match.status = allDone
            ? MatchStatus.COMPLETED
            : this.statusByCapacity(match);
          needsMatchSave = true;
        } else {
          for (const g of dto.tournamentGames) {
            const f = g.fixtureId
              ? fixtures.find((x) => x.id === g.fixtureId)
              : fixtures.find(
                  (x) =>
                    x.round === (g.round ?? 0) &&
                    x.order === (g.order ?? 0),
                );
            if (!f) {
              continue;
            }
            const aIdx = g.teamAIndex < 0 ? null : g.teamAIndex;
            const bIdx = g.teamBIndex < 0 ? null : g.teamBIndex;
            if (
              aIdx != null &&
              bIdx != null &&
              (aIdx >= n || bIdx >= n || aIdx === bIdx)
            ) {
              throw new BadRequestException('Invalid tournament game');
            }
            if (
              aIdx != null &&
              bIdx == null &&
              aIdx >= n
            ) {
              throw new BadRequestException('Invalid tournament game');
            }
            if (
              aIdx == null &&
              bIdx != null &&
              bIdx >= n
            ) {
              throw new BadRequestException('Invalid tournament game');
            }
            const ci = g.courtIndex ?? 0;
            if (ci < 0 || ci >= courts) {
              throw new BadRequestException('Invalid tournament game courtIndex');
            }
            f.teamAIndex = aIdx;
            f.teamBIndex = bIdx;
            f.scoreA = g.scoreA;
            f.scoreB = g.scoreB;
            f.courtIndex = g.courtIndex ?? null;
          }
          await this.fixtureRepo.save(fixtures);
          await this.tournamentEngine.run(matchId, pts, courts);
          await this.persistTournamentGamesJson(matchId);
          const reloadedFx = await this.fixtureRepo.find({
            where: { eventMatchId: matchId },
            order: { round: 'ASC', order: 'ASC' },
          });
          match.tournamentGames =
            this.projectTournamentGamesFromFixtures(reloadedFx);
          const allFinished =
            reloadedFx.length > 0 &&
            reloadedFx.every((f) => f.status === FixtureStatus.FINISHED);
          match.status = allFinished
            ? MatchStatus.COMPLETED
            : this.statusByCapacity(match);
          needsMatchSave = true;
        }
      }
      this.matchesGateway.broadcastMatchUpdate(matchId, {
        matchId,
        currentPlayers: match.currentPlayers,
        maxPlayers: match.maxPlayers,
        status: match.status,
        courtId: match.courtId,
        tournamentStateUpdated: true,
      });
    }

    if (needsMatchSave) {
      await this.matchRepo.save(match);
    }

    return this.findById(matchId);
  }

  private getFixtureSideForUser(
    fixture: TournamentFixtureMatch,
    match: Match,
    userId: string,
  ): 'A' | 'B' | null {
    const p = match.participants.find((x) => x.userId === userId);
    if (!p || p.teamIndex == null) {
      return null;
    }
    if (
      fixture.teamAIndex != null &&
      p.teamIndex === fixture.teamAIndex
    ) {
      return 'A';
    }
    if (
      fixture.teamBIndex != null &&
      p.teamIndex === fixture.teamBIndex
    ) {
      return 'B';
    }
    return null;
  }

  private async emitTournamentSocket(matchId: string): Promise<void> {
    const m = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!m) {
      return;
    }
    this.matchesGateway.broadcastMatchUpdate(matchId, {
      matchId,
      currentPlayers: m.currentPlayers,
      maxPlayers: m.maxPlayers,
      status: m.status,
      courtId: m.courtId,
      tournamentStateUpdated: true,
    });
  }

  async submitFixtureScore(
    fixtureId: string,
    userId: string,
    score: number,
  ): Promise<TournamentFixtureMatch> {
    if (!Number.isInteger(score) || score < 0) {
      throw new BadRequestException('Invalid score');
    }
    const fixture = await this.fixtureRepo.findOne({ where: { id: fixtureId } });
    if (!fixture) {
      throw new NotFoundException('Fixture not found');
    }
    const match = await this.findById(fixture.eventMatchId);
    if (match.eventFormat !== EventFormat.TOURNAMENT) {
      throw new BadRequestException('Not a tournament match');
    }
    if (fixture.status !== FixtureStatus.LIVE) {
      throw new BadRequestException('Fixture is not live');
    }
    const side = this.getFixtureSideForUser(fixture, match, userId);
    if (!side) {
      throw new ForbiddenException('You are not on a team in this fixture');
    }
    if (side === 'A' && fixture.scoreAConfirmed) {
      throw new BadRequestException('Your score is already locked');
    }
    if (side === 'B' && fixture.scoreBConfirmed) {
      throw new BadRequestException('Your score is already locked');
    }
    if (side === 'A') {
      fixture.scoreA = score;
    } else {
      fixture.scoreB = score;
    }
    await this.fixtureRepo.save(fixture);
    await this.persistTournamentGamesJson(fixture.eventMatchId);
    await this.emitTournamentSocket(fixture.eventMatchId);
    return this.fixtureRepo.findOneOrFail({ where: { id: fixtureId } });
  }

  async confirmFixtureScore(
    fixtureId: string,
    userId: string,
  ): Promise<TournamentFixtureMatch> {
    const fixture = await this.fixtureRepo.findOne({ where: { id: fixtureId } });
    if (!fixture) {
      throw new NotFoundException('Fixture not found');
    }
    const match = await this.findById(fixture.eventMatchId);
    if (match.eventFormat !== EventFormat.TOURNAMENT) {
      throw new BadRequestException('Not a tournament match');
    }
    if (fixture.status !== FixtureStatus.LIVE) {
      throw new BadRequestException('Fixture is not live');
    }
    const side = this.getFixtureSideForUser(fixture, match, userId);
    if (!side) {
      throw new ForbiddenException('You are not on a team in this fixture');
    }
    if (side === 'A' && fixture.scoreAConfirmed) {
      throw new BadRequestException('Already confirmed');
    }
    if (side === 'B' && fixture.scoreBConfirmed) {
      throw new BadRequestException('Already confirmed');
    }
    const pts = match.tournamentPointsPerMatch ?? 21;
    const nextAConf = side === 'A' ? true : fixture.scoreAConfirmed;
    const nextBConf = side === 'B' ? true : fixture.scoreBConfirmed;
    if (nextAConf && nextBConf) {
      const sa = fixture.scoreA;
      const sb = fixture.scoreB;
      if (sa === sb) {
        throw new BadRequestException('Scores cannot be tied');
      }
      if (Math.max(sa, sb) < pts) {
        throw new BadRequestException(
          `A team must reach at least ${pts} points to finish`,
        );
      }
    }
    if (side === 'A') {
      fixture.scoreAConfirmed = true;
    } else {
      fixture.scoreBConfirmed = true;
    }
    await this.fixtureRepo.save(fixture);
    const fresh = await this.fixtureRepo.findOneOrFail({
      where: { id: fixtureId },
    });
    const courts = Math.max(1, match.tournamentCourtCount ?? 1);

    if (fresh.scoreAConfirmed && fresh.scoreBConfirmed) {
      await this.tournamentEngine.run(fixture.eventMatchId, pts, courts);
      await this.persistTournamentGamesJson(fixture.eventMatchId);
      const reloadedFx = await this.fixtureRepo.find({
        where: { eventMatchId: fixture.eventMatchId },
        order: { round: 'ASC', order: 'ASC' },
      });
      const matchToSave = await this.matchRepo.findOne({
        where: { id: fixture.eventMatchId },
        relations: ['participants'],
      });
      if (!matchToSave) {
        throw new NotFoundException('Match not found');
      }
      matchToSave.tournamentGames =
        this.projectTournamentGamesFromFixtures(reloadedFx);
      const allFinished =
        reloadedFx.length > 0 &&
        reloadedFx.every((f) => f.status === FixtureStatus.FINISHED);
      matchToSave.status = allFinished
        ? MatchStatus.COMPLETED
        : this.statusByCapacity(matchToSave);
      await this.matchRepo.save(matchToSave);
    } else {
      await this.persistTournamentGamesJson(fixture.eventMatchId);
    }
    await this.emitTournamentSocket(fixture.eventMatchId);
    return this.fixtureRepo.findOneOrFail({ where: { id: fixtureId } });
  }

  async organizerOverrideFixtureScore(
    fixtureId: string,
    organizerId: string,
    scoreA: number,
    scoreB: number,
  ): Promise<TournamentFixtureMatch> {
    if (
      !Number.isInteger(scoreA) ||
      !Number.isInteger(scoreB) ||
      scoreA < 0 ||
      scoreB < 0
    ) {
      throw new BadRequestException('Invalid scores');
    }
    const fixture = await this.fixtureRepo.findOne({ where: { id: fixtureId } });
    if (!fixture) {
      throw new NotFoundException('Fixture not found');
    }
    const match = await this.findById(fixture.eventMatchId);
    if (match.eventFormat !== EventFormat.TOURNAMENT) {
      throw new BadRequestException('Not a tournament match');
    }
    if (match.creatorId !== organizerId) {
      throw new ForbiddenException('Only the organizer can override scores');
    }
    if (fixture.scoreAConfirmed && fixture.scoreBConfirmed) {
      throw new ForbiddenException('Both scores are locked');
    }
    if (fixture.status === FixtureStatus.FINISHED) {
      throw new BadRequestException('Fixture is already finished');
    }
    fixture.scoreA = scoreA;
    fixture.scoreB = scoreB;
    fixture.scoreAConfirmed = false;
    fixture.scoreBConfirmed = false;
    await this.fixtureRepo.save(fixture);
    await this.persistTournamentGamesJson(fixture.eventMatchId);
    await this.emitTournamentSocket(fixture.eventMatchId);
    return this.fixtureRepo.findOneOrFail({ where: { id: fixtureId } });
  }

  async removeParticipant(
    matchId: string,
    organizerId: string,
    targetUserId: string,
  ): Promise<Match> {
    const match = await this.findById(matchId);
    if (match.creatorId !== organizerId) {
      throw new ForbiddenException('Only the organizer can remove a player');
    }
    if (targetUserId === match.creatorId) {
      throw new BadRequestException('Cannot remove the organizer');
    }
    if (match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Match is cancelled');
    }
    const participant = await this.participantRepo.findOne({
      where: { matchId, userId: targetUserId },
    });
    if (!participant) {
      throw new BadRequestException('User is not a participant');
    }
    await this.participantRepo.remove(participant);
    await this.chatMuteRepo.delete({
      matchId,
      mutedUserId: targetUserId,
    });
    const nextCount = Math.max(0, match.currentPlayers - 1);
    const nextStatus =
      match.status === MatchStatus.FULL ? MatchStatus.OPEN : match.status;
    await this.matchRepo.update(matchId, {
      currentPlayers: nextCount,
      status: nextStatus,
    });
    await this.redisService.set(
      `match:${matchId}:count`,
      String(nextCount),
      NEARBY_MATCHES_TTL * 60,
    );
    await this.invalidateNearbyCache();
    return this.findById(matchId);
  }

  /**
   * Le joueur assigne sa propre équipe : match simple (0 / 1 / null) ou tournoi (0 … teamCount-1 / null).
   */
  async setMyTeam(
    matchId: string,
    userId: string,
    teamIndex: number | null | undefined,
  ): Promise<Match> {
    if (teamIndex === undefined) {
      throw new BadRequestException(
        'teamIndex is required (team index or null to unassign)',
      );
    }

    const match = await this.findById(matchId);

    if (match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Match is cancelled');
    }

    // Block team changes once the event has started (live)
    const isLive =
      match.status !== MatchStatus.COMPLETED &&
      new Date(match.scheduledAt).getTime() <= Date.now();
    if (isLive && teamIndex !== null) {
      throw new BadRequestException(
        'Teams are locked while the event is in progress',
      );
    }

    const participant = await this.participantRepo.findOne({
      where: { matchId, userId },
    });
    if (!participant) {
      throw new ForbiddenException('You must join this match first');
    }

    if (match.eventFormat === EventFormat.TOURNAMENT) {
      const n = match.teamCount ?? 0;
      const size = match.teamSize ?? 0;
      if (n < 1 || size < 1) {
        throw new BadRequestException('Invalid tournament configuration');
      }
      if (teamIndex !== null) {
        if (!Number.isInteger(teamIndex) || teamIndex < 0 || teamIndex >= n) {
          throw new BadRequestException('Invalid team index for this tournament');
        }
        let countOnTeam = 0;
        for (const p of match.participants) {
          if (p.userId === userId) {
            continue;
          }
          if (p.teamIndex === teamIndex) {
            countOnTeam += 1;
          }
        }
        if (countOnTeam >= size) {
          throw new BadRequestException('This team is full');
        }
      }
      participant.teamIndex = teamIndex;
      await this.participantRepo.save(participant);
      await this.invalidateNearbyCache();
      return this.findById(matchId);
    }

    if (teamIndex !== null && teamIndex !== 0 && teamIndex !== 1) {
      throw new BadRequestException('teamIndex must be 0, 1, or null');
    }

    const slotsPerTeam = Math.floor(match.maxPlayers / 2);
    if (slotsPerTeam < 1) {
      throw new BadRequestException('Invalid match capacity');
    }

    let countA = 0;
    let countB = 0;
    for (const p of match.participants) {
      if (p.userId === userId) {
        continue;
      }
      if (p.teamIndex === 0) {
        countA += 1;
      } else if (p.teamIndex === 1) {
        countB += 1;
      }
    }

    if (teamIndex === 0) {
      countA += 1;
    } else if (teamIndex === 1) {
      countB += 1;
    }

    if (countA > slotsPerTeam || countB > slotsPerTeam) {
      throw new BadRequestException('This team is full');
    }

    participant.teamIndex = teamIndex;
    await this.participantRepo.save(participant);
    await this.invalidateNearbyCache();

    return this.findById(matchId);
  }

  /**
   * Recrée le même événement (lieu, format, options), horodaté à l’instant,
   * et réinscrit les participants de la partie source (sauf le créateur, déjà présent).
   */
  async renewMatch(sourceMatchId: string, userId: string): Promise<Match> {
    const source = await this.findById(sourceMatchId);

    if (source.creatorId !== userId) {
      throw new ForbiddenException('Only the organizer can renew this match');
    }
    if (source.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Cannot renew a cancelled match');
    }

    const dto = {
      courtId: source.courtId,
      scheduledAt: new Date().toISOString(),
      skillLevel: source.skillLevel,
      volleyType: source.volleyType,
      eventFormat: source.eventFormat,
      maxPlayers:
        source.eventFormat === EventFormat.TOURNAMENT
          ? undefined
          : source.maxPlayers,
      teamCount:
        source.eventFormat === EventFormat.TOURNAMENT
          ? source.teamCount ?? undefined
          : undefined,
      teamSize:
        source.eventFormat === EventFormat.TOURNAMENT
          ? source.teamSize ?? undefined
          : undefined,
      matchSets:
        source.eventFormat === EventFormat.MATCH
          ? source.matchSets ?? undefined
          : undefined,
      pointsToWin:
        source.eventFormat === EventFormat.MATCH
          ? source.pointsToWin ?? undefined
          : undefined,
      tournamentPointsPerMatch:
        source.eventFormat === EventFormat.TOURNAMENT
          ? source.tournamentPointsPerMatch ?? undefined
          : undefined,
      tournamentCourtCount:
        source.eventFormat === EventFormat.TOURNAMENT
          ? source.tournamentCourtCount ?? undefined
          : undefined,
      tournamentSystem:
        source.eventFormat === EventFormat.TOURNAMENT
          ? source.tournamentSystem ?? undefined
          : undefined,
      description: source.description ?? undefined,
    } as CreateMatchDto;

    const newMatch = await this.create(userId, dto);

    const invitable = source.participants.filter((p) => p.userId !== userId);
    let currentPlayers = newMatch.currentPlayers;

    for (const p of invitable) {
      await this.participantRepo.insert({
        matchId: newMatch.id,
        userId: p.userId,
        teamIndex: p.teamIndex,
      });
      currentPlayers += 1;
    }

    const status =
      currentPlayers >= newMatch.maxPlayers
        ? MatchStatus.FULL
        : MatchStatus.OPEN;

    await this.matchRepo.update(newMatch.id, {
      currentPlayers,
      status,
    });

    await this.redisService.set(
      `match:${newMatch.id}:count`,
      String(currentPlayers),
      NEARBY_MATCHES_TTL * 60,
    );

    await this.invalidateNearbyCache();

    await this.notificationsService.notifyInvitedToRenewedMatch(
      newMatch.id,
      invitable.map((x) => x.userId),
      source.creator?.username ?? 'Organizer',
    );

    return this.findById(newMatch.id);
  }

  async deleteMatch(matchId: string, userId: string): Promise<void> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    if (match.creatorId !== userId) {
      throw new ForbiddenException('Only the organizer can delete this match');
    }
    await this.participantRepo.delete({ matchId });
    await this.redisService.del(`match:${matchId}:count`);
    await this.matchRepo.delete(matchId);
    await this.invalidateNearbyCache();
  }

  private async invalidateNearbyCache(): Promise<void> {
    const keys = await this.redisService.keys('nearby:matches:*');
    if (keys.length > 0) {
      await this.redisService.del(...keys);
    }
  }

  private statusByCapacity(match: Match): MatchStatus {
    if (match.status === MatchStatus.CANCELLED) {
      return MatchStatus.CANCELLED;
    }
    return match.currentPlayers >= match.maxPlayers
      ? MatchStatus.FULL
      : MatchStatus.OPEN;
  }

  private async attachTournamentData(match: Match): Promise<void> {
    if (match.eventFormat !== EventFormat.TOURNAMENT) {
      return;
    }
    try {
      await this.ensureTournamentFixturesFromLegacy(match);
      const fixtures = await this.fixtureRepo.find({
        where: { eventMatchId: match.id },
        order: { round: 'ASC', order: 'ASC' },
      });
      Object.assign(match, { tournamentFixtures: fixtures });
      if (fixtures.length > 0) {
        match.tournamentGames = this.projectTournamentGamesFromFixtures(
          fixtures,
        ) as Match['tournamentGames'];
      }
    } catch {
      // Keep match detail readable even if fixture storage is not yet available.
      Object.assign(match, { tournamentFixtures: [] });
    }
  }

  private async seedTournamentFixturesForNewMatch(
    matchId: string,
    system: TournamentSystem,
    teamCount: number,
    pointsPerMatch: number,
    courtCount: number,
  ): Promise<void> {
    const rows = this.tournamentGenerator.generateRows(system, teamCount);
    if (rows.length === 0) {
      return;
    }
    const entities = rows.map((r) =>
      this.fixtureRepo.create({
        ...r,
        eventMatchId: matchId,
      }),
    );
    await this.fixtureRepo.save(entities);
    await this.tournamentEngine.run(matchId, pointsPerMatch, courtCount);
    await this.persistTournamentGamesJson(matchId);
  }

  private async persistTournamentGamesJson(matchId: string): Promise<void> {
    const fixtures = await this.fixtureRepo.find({
      where: { eventMatchId: matchId },
      order: { round: 'ASC', order: 'ASC' },
    });
    const proj = this.projectTournamentGamesFromFixtures(fixtures);
    await this.matchRepo.update(matchId, {
      tournamentGames: proj as Match['tournamentGames'],
    });
  }

  private projectTournamentGamesFromFixtures(
    fixtures: TournamentFixtureMatch[],
  ): NonNullable<Match['tournamentGames']> {
    return fixtures.map((f) => ({
      fixtureId: f.id,
      teamAIndex: f.teamAIndex ?? -1,
      teamBIndex: f.teamBIndex ?? -1,
      scoreA: f.scoreA,
      scoreB: f.scoreB,
      scoreAConfirmed: f.scoreAConfirmed,
      scoreBConfirmed: f.scoreBConfirmed,
      courtIndex: f.courtIndex ?? 0,
      round: f.round,
      order: f.order,
      status: f.status,
      phase: f.phase,
    })) as NonNullable<Match['tournamentGames']>;
  }

  private async ensureTournamentFixturesFromLegacy(match: Match): Promise<void> {
    if (match.eventFormat !== EventFormat.TOURNAMENT || match.teamCount == null) {
      return;
    }
    const existing = await this.fixtureRepo.count({
      where: { eventMatchId: match.id },
    });
    if (existing > 0) {
      return;
    }
    const games = match.tournamentGames;
    if (!games?.length) {
      return;
    }
    const entities = games.map((g, idx) =>
      this.fixtureRepo.create({
        id: randomUUID(),
        eventMatchId: match.id,
        teamAIndex: g.teamAIndex,
        teamBIndex: g.teamBIndex,
        scoreA: g.scoreA ?? 0,
        scoreB: g.scoreB ?? 0,
        courtIndex: g.courtIndex ?? null,
        status: FixtureStatus.READY,
        dependsOnFixtureIds: null,
        feedsFixtureId: null,
        feedsSlot: null,
        round: g.round ?? 0,
        order: g.order ?? idx,
        phase: null,
      }),
    );
    await this.fixtureRepo.save(entities);
  }
}
