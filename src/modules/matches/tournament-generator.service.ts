import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TournamentSystem } from '../../common/enums';
import {
  FixtureStatus,
  TournamentFixtureMatch,
} from './tournament-fixture.entity';

export type FixtureRowInput = Pick<
  TournamentFixtureMatch,
  | 'id'
  | 'teamAIndex'
  | 'teamBIndex'
  | 'scoreA'
  | 'scoreB'
  | 'courtIndex'
  | 'status'
  | 'dependsOnFixtureIds'
  | 'feedsFixtureId'
  | 'feedsSlot'
  | 'round'
  | 'order'
  | 'phase'
>;

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) {
    p *= 2;
  }
  return p;
}

@Injectable()
export class TournamentGeneratorService {
  /**
   * Génère les lignes à insérer pour un événement tournoi.
   */
  generateRows(
    system: TournamentSystem,
    teamCount: number,
  ): FixtureRowInput[] {
    if (teamCount < 3) {
      return [];
    }
    switch (system) {
      case TournamentSystem.SINGLE_ELIMINATION:
        return this.singleElimination(teamCount);
      case TournamentSystem.ROUND_ROBIN:
        return this.roundRobin(teamCount);
      case TournamentSystem.POOLS_FINALS:
        return this.poolsAndFinals(teamCount);
      default:
        return this.singleElimination(teamCount);
    }
  }

  /** Élimination directe : arbre binaire, équipes 0..n-1 en entrée du tour 0. */
  private singleElimination(teamCount: number): FixtureRowInput[] {
    const b = nextPow2(teamCount);
    const numRounds = Math.log2(b);
    const idsByRound: string[][] = [];
    for (let r = 0; r < numRounds; r += 1) {
      const count = b / 2 ** (r + 1);
      idsByRound[r] = Array.from({ length: count }, () => randomUUID());
    }

    const rows: FixtureRowInput[] = [];

    for (let r = numRounds - 1; r >= 0; r -= 1) {
      const count = idsByRound[r].length;
      for (let i = 0; i < count; i += 1) {
        const id = idsByRound[r][i];
        let teamAIndex: number | null = null;
        let teamBIndex: number | null = null;
        let dependsOnFixtureIds: string[] | null = null;
        let feedsFixtureId: string | null = null;
        let feedsSlot: 'A' | 'B' | null = null;

        if (r === 0) {
          const t1 = i * 2;
          const t2 = i * 2 + 1;
          teamAIndex = t1 < teamCount ? t1 : null;
          teamBIndex = t2 < teamCount ? t2 : null;
          if (r < numRounds - 1) {
            const parent = idsByRound[r + 1][Math.floor(i / 2)];
            feedsFixtureId = parent;
            feedsSlot = i % 2 === 0 ? 'A' : 'B';
          }
        } else {
          const left = idsByRound[r - 1][i * 2];
          const right = idsByRound[r - 1][i * 2 + 1];
          dependsOnFixtureIds = [left, right];
          if (r < numRounds - 1) {
            const parent = idsByRound[r + 1][Math.floor(i / 2)];
            feedsFixtureId = parent;
            feedsSlot = i % 2 === 0 ? 'A' : 'B';
          }
        }

        const status = this.initialStatus(
          teamAIndex,
          teamBIndex,
          dependsOnFixtureIds,
        );

        rows.push({
          id,
          teamAIndex,
          teamBIndex,
          scoreA: 0,
          scoreB: 0,
          courtIndex: null,
          status,
          dependsOnFixtureIds,
          feedsFixtureId,
          feedsSlot,
          round: r,
          order: i,
          phase: null,
        });
      }
    }

    return rows;
  }

  private initialStatus(
    teamAIndex: number | null,
    teamBIndex: number | null,
    dependsOnFixtureIds: string[] | null,
  ): FixtureStatus {
    if (dependsOnFixtureIds && dependsOnFixtureIds.length > 0) {
      return FixtureStatus.PENDING;
    }
    if (
      teamAIndex != null &&
      teamBIndex != null &&
      teamAIndex !== teamBIndex
    ) {
      return FixtureStatus.READY;
    }
    if (teamAIndex != null && teamBIndex == null) {
      return FixtureStatus.READY;
    }
    if (teamAIndex == null && teamBIndex != null) {
      return FixtureStatus.READY;
    }
    return FixtureStatus.PENDING;
  }

  /** Toutes les paires ; pas de dépendances. */
  private roundRobin(teamCount: number): FixtureRowInput[] {
    const rows: FixtureRowInput[] = [];
    let order = 0;
    for (let i = 0; i < teamCount; i += 1) {
      for (let j = i + 1; j < teamCount; j += 1) {
        rows.push({
          id: randomUUID(),
          teamAIndex: i,
          teamBIndex: j,
          scoreA: 0,
          scoreB: 0,
          courtIndex: null,
          status: FixtureStatus.READY,
          dependsOnFixtureIds: null,
          feedsFixtureId: null,
          feedsSlot: null,
          round: 0,
          order,
          phase: null,
        });
        order += 1;
      }
    }
    return rows;
  }

  /**
   * Deux poules en round-robin + une finale sans dépendances automatiques
   * (classements à gérer ensuite / assignation manuelle des finalistes).
   */
  private poolsAndFinals(teamCount: number): FixtureRowInput[] {
    const rows: FixtureRowInput[] = [];
    const half = Math.ceil(teamCount / 2);
    const poolA = Array.from({ length: half }, (_, i) => i);
    const poolB = Array.from({ length: teamCount - half }, (_, i) => i + half);

    const addPool = (indices: number[], phase: string) => {
      let order = 0;
      for (let a = 0; a < indices.length; a += 1) {
        for (let b = a + 1; b < indices.length; b += 1) {
          rows.push({
            id: randomUUID(),
            teamAIndex: indices[a],
            teamBIndex: indices[b],
            scoreA: 0,
            scoreB: 0,
            courtIndex: null,
            status: FixtureStatus.READY,
            dependsOnFixtureIds: null,
            feedsFixtureId: null,
            feedsSlot: null,
            round: 0,
            order,
            phase,
          });
          order += 1;
        }
      }
    };

    addPool(poolA, 'pool_a');
    addPool(poolB, 'pool_b');

    const finalId = randomUUID();
    rows.push({
      id: finalId,
      teamAIndex: null,
      teamBIndex: null,
      scoreA: 0,
      scoreB: 0,
      courtIndex: null,
      status: FixtureStatus.PENDING,
      dependsOnFixtureIds: null,
      feedsFixtureId: null,
      feedsSlot: null,
      round: 1,
      order: 0,
      phase: 'finals',
    });

    return rows;
  }
}
