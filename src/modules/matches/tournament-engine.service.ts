import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FixtureStatus,
  TournamentFixtureMatch,
} from './tournament-fixture.entity';

@Injectable()
export class TournamentEngineService {
  constructor(
    @InjectRepository(TournamentFixtureMatch)
    private readonly fixtureRepo: Repository<TournamentFixtureMatch>,
  ) {}

  /**
   * Met à jour statuts, propagation des vainqueurs, assignation des terrains logiques.
   * Idempotent : peut être rappelé après chaque sauvegarde organisateur.
   */
  async run(
    eventMatchId: string,
    targetPoints: number,
    courtCount: number,
  ): Promise<TournamentFixtureMatch[]> {
    const fixtures = await this.fixtureRepo.find({
      where: { eventMatchId },
      order: { round: 'ASC', order: 'ASC' },
    });
    if (fixtures.length === 0) {
      return [];
    }

    const byId = new Map(fixtures.map((f) => [f.id, f]));
    for (let pass = 0; pass < 12; pass += 1) {
      this.applyWalkovers(fixtures, targetPoints);
      this.propagateWinners(fixtures, byId);
      this.promotePendingToReady(fixtures);
      this.applyWalkovers(fixtures, targetPoints);
      this.resolveFinishedByScore(fixtures, targetPoints);
      this.assignCourtsToReady(fixtures, courtCount);
    }

    await this.fixtureRepo.save(fixtures);
    return fixtures;
  }

  private applyWalkovers(
    fixtures: TournamentFixtureMatch[],
    targetPoints: number,
  ): void {
    const now = new Date();
    for (const f of fixtures) {
      if (f.status === FixtureStatus.FINISHED) {
        continue;
      }
      if (f.teamAIndex != null && f.teamBIndex == null) {
        f.status = FixtureStatus.FINISHED;
        f.scoreA = targetPoints;
        f.scoreB = 0;
        f.endedAt = now;
        f.courtIndex = null;
      } else if (f.teamAIndex == null && f.teamBIndex != null) {
        f.status = FixtureStatus.FINISHED;
        f.scoreA = 0;
        f.scoreB = targetPoints;
        f.endedAt = now;
        f.courtIndex = null;
      }
    }
  }

  private propagateWinners(
    fixtures: TournamentFixtureMatch[],
    byId: Map<string, TournamentFixtureMatch>,
  ): boolean {
    let changed = false;
    for (const f of fixtures) {
      if (f.status !== FixtureStatus.FINISHED) {
        continue;
      }
      if (!f.feedsFixtureId || !f.feedsSlot) {
        continue;
      }
      const target = byId.get(f.feedsFixtureId);
      if (!target) {
        continue;
      }
      const win = this.winnerTeamIndex(f);
      if (win == null) {
        continue;
      }
      if (f.feedsSlot === 'A' && target.teamAIndex !== win) {
        target.teamAIndex = win;
        changed = true;
      }
      if (f.feedsSlot === 'B' && target.teamBIndex !== win) {
        target.teamBIndex = win;
        changed = true;
      }
    }
    return changed;
  }

  private winnerTeamIndex(f: TournamentFixtureMatch): number | null {
    if (f.scoreA > f.scoreB) {
      return f.teamAIndex;
    }
    if (f.scoreB > f.scoreA) {
      return f.teamBIndex;
    }
    return null;
  }

  private promotePendingToReady(fixtures: TournamentFixtureMatch[]): void {
    for (const f of fixtures) {
      if (f.status === FixtureStatus.FINISHED) {
        continue;
      }
      const deps = f.dependsOnFixtureIds;
      if (deps && deps.length > 0) {
        const allDone = deps.every(
          (id) =>
            fixtures.some(
              (x) => x.id === id && x.status === FixtureStatus.FINISHED,
            ),
        );
        if (!allDone) {
          continue;
        }
      }
      const twoTeams =
        f.teamAIndex != null &&
        f.teamBIndex != null &&
        f.teamAIndex !== f.teamBIndex;
      const walk =
        (f.teamAIndex != null && f.teamBIndex == null) ||
        (f.teamAIndex == null && f.teamBIndex != null);
      if ((twoTeams || walk) && f.status === FixtureStatus.PENDING) {
        f.status = FixtureStatus.READY;
      }
    }
  }

  private resolveFinishedByScore(
    fixtures: TournamentFixtureMatch[],
    targetPoints: number,
  ): boolean {
    let changed = false;
    const now = new Date();
    for (const f of fixtures) {
      if (
        f.status !== FixtureStatus.LIVE &&
        f.status !== FixtureStatus.READY
      ) {
        continue;
      }
      const { scoreA: a, scoreB: b } = f;
      if (a === b) {
        continue;
      }
      if (a < targetPoints && b < targetPoints) {
        continue;
      }
      f.status = FixtureStatus.FINISHED;
      f.endedAt = now;
      f.courtIndex = null;
      changed = true;
    }
    return changed;
  }

  private assignCourtsToReady(
    fixtures: TournamentFixtureMatch[],
    courtCount: number,
  ): boolean {
    let changed = false;
    const cmax = Math.max(1, courtCount);
    const occupiedCourts = new Set<number>();
    const busyTeams = new Set<number>();

    for (const f of fixtures) {
      if (f.status === FixtureStatus.LIVE) {
        if (f.courtIndex != null) occupiedCourts.add(f.courtIndex);
        if (f.teamAIndex != null && f.teamAIndex >= 0) busyTeams.add(f.teamAIndex);
        if (f.teamBIndex != null && f.teamBIndex >= 0) busyTeams.add(f.teamBIndex);
      }
    }

    for (const f of fixtures) {
      if (f.status !== FixtureStatus.READY) {
        continue;
      }
      if (f.courtIndex != null) {
        continue;
      }
      // Skip if either team is already playing on another court
      if (f.teamAIndex != null && f.teamAIndex >= 0 && busyTeams.has(f.teamAIndex)) {
        continue;
      }
      if (f.teamBIndex != null && f.teamBIndex >= 0 && busyTeams.has(f.teamBIndex)) {
        continue;
      }
      for (let c = 0; c < cmax; c += 1) {
        if (!occupiedCourts.has(c)) {
          f.courtIndex = c;
          f.status = FixtureStatus.LIVE;
          f.startedAt = new Date();
          occupiedCourts.add(c);
          if (f.teamAIndex != null && f.teamAIndex >= 0) busyTeams.add(f.teamAIndex);
          if (f.teamBIndex != null && f.teamBIndex >= 0) busyTeams.add(f.teamBIndex);
          changed = true;
          break;
        }
      }
    }
    return changed;
  }
}
