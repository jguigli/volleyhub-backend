import { TournamentEngineService } from '../../src/modules/matches/tournament-engine.service';
import {
  FixtureStatus,
  TournamentFixtureMatch,
} from '../../src/modules/matches/tournament-fixture.entity';

function makeFixture(
  overrides: Partial<TournamentFixtureMatch> = {},
): TournamentFixtureMatch {
  return {
    id: 'fix-1',
    eventMatchId: 'event-1',
    eventMatch: {} as any,
    teamAIndex: null,
    teamBIndex: null,
    scoreA: 0,
    scoreB: 0,
    scoreAConfirmed: false,
    scoreBConfirmed: false,
    courtIndex: null,
    status: FixtureStatus.PENDING,
    dependsOnFixtureIds: null,
    feedsFixtureId: null,
    feedsSlot: null,
    round: 0,
    order: 0,
    phase: null,
    startedAt: null,
    endedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('TournamentEngineService (unit)', () => {
  let service: TournamentEngineService;
  let fixtureRepo: {
    find: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    fixtureRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((fixtures) => Promise.resolve(fixtures)),
    };
    service = new TournamentEngineService(fixtureRepo as any);
  });

  describe('run()', () => {
    it('should return empty array when no fixtures exist', async () => {
      fixtureRepo.find.mockResolvedValue([]);

      const result = await service.run('event-1', 25, 2);

      expect(result).toEqual([]);
      expect(fixtureRepo.save).not.toHaveBeenCalled();
    });

    it('should load fixtures for the given eventMatchId and save after processing', async () => {
      const fixtures = [
        makeFixture({ id: 'f1', teamAIndex: 0, teamBIndex: 1, status: FixtureStatus.READY }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      await service.run('event-1', 25, 2);

      expect(fixtureRepo.find).toHaveBeenCalledWith({
        where: { eventMatchId: 'event-1' },
        order: { round: 'ASC', order: 'ASC' },
      });
      expect(fixtureRepo.save).toHaveBeenCalledWith(fixtures);
    });

    it('should advance a READY fixture with both teams to LIVE with court assignment', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          status: FixtureStatus.READY,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 2);

      expect(result[0].status).toBe(FixtureStatus.LIVE);
      expect(result[0].courtIndex).toBe(0);
    });
  });

  describe('applyWalkovers (via run)', () => {
    it('should give walkover win to teamA when teamB is null', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 3,
          teamBIndex: null,
          status: FixtureStatus.READY,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 1);

      const f = result[0];
      expect(f.status).toBe(FixtureStatus.FINISHED);
      expect(f.scoreA).toBe(25);
      expect(f.scoreB).toBe(0);
      expect(f.courtIndex).toBeNull();
    });

    it('should give walkover win to teamB when teamA is null', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: null,
          teamBIndex: 5,
          status: FixtureStatus.READY,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 15, 1);

      const f = result[0];
      expect(f.status).toBe(FixtureStatus.FINISHED);
      expect(f.scoreA).toBe(0);
      expect(f.scoreB).toBe(15);
    });

    it('should not change fixtures that have both teams', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          status: FixtureStatus.READY,
          scoreA: 0,
          scoreB: 0,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 1);

      const f = result[0];
      // Should become LIVE (assigned court), not FINISHED via walkover
      expect(f.status).toBe(FixtureStatus.LIVE);
      expect(f.scoreA).toBe(0);
      expect(f.scoreB).toBe(0);
    });

    it('should not modify already FINISHED fixtures', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: null,
          status: FixtureStatus.FINISHED,
          scoreA: 25,
          scoreB: 0,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 1);

      expect(result[0].status).toBe(FixtureStatus.FINISHED);
      expect(result[0].scoreA).toBe(25);
    });
  });

  describe('propagateWinners (via run)', () => {
    it('should feed winner team index into the next fixture slot', async () => {
      const fixtures = [
        makeFixture({
          id: 'f-semi1',
          teamAIndex: 0,
          teamBIndex: 1,
          scoreA: 25,
          scoreB: 18,
          status: FixtureStatus.FINISHED,
          feedsFixtureId: 'f-final',
          feedsSlot: 'A',
          round: 0,
          order: 0,
        }),
        makeFixture({
          id: 'f-semi2',
          teamAIndex: 2,
          teamBIndex: 3,
          scoreA: 10,
          scoreB: 25,
          status: FixtureStatus.FINISHED,
          feedsFixtureId: 'f-final',
          feedsSlot: 'B',
          round: 0,
          order: 1,
        }),
        makeFixture({
          id: 'f-final',
          teamAIndex: null,
          teamBIndex: null,
          status: FixtureStatus.PENDING,
          dependsOnFixtureIds: ['f-semi1', 'f-semi2'],
          round: 1,
          order: 0,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 1);

      const final = result.find((f) => f.id === 'f-final')!;
      // teamA should be winner of semi1 (team 0, scoreA > scoreB)
      expect(final.teamAIndex).toBe(0);
      // teamB should be winner of semi2 (team 3, scoreB > scoreA)
      expect(final.teamBIndex).toBe(3);
    });
  });

  describe('assignCourtsToReady (via run)', () => {
    it('should assign courts to READY fixtures', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          status: FixtureStatus.READY,
        }),
        makeFixture({
          id: 'f2',
          teamAIndex: 2,
          teamBIndex: 3,
          status: FixtureStatus.READY,
          order: 1,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 2);

      expect(result[0].courtIndex).toBe(0);
      expect(result[0].status).toBe(FixtureStatus.LIVE);
      expect(result[1].courtIndex).toBe(1);
      expect(result[1].status).toBe(FixtureStatus.LIVE);
    });

    it('should NOT assign a court if a team is already playing (busyTeams check)', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          status: FixtureStatus.LIVE,
          courtIndex: 0,
        }),
        makeFixture({
          id: 'f2',
          teamAIndex: 0,
          teamBIndex: 2,
          status: FixtureStatus.READY,
          order: 1,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 2);

      // f2 should NOT be assigned because team 0 is busy in f1
      const f2 = result.find((f) => f.id === 'f2')!;
      expect(f2.status).toBe(FixtureStatus.READY);
      expect(f2.courtIndex).toBeNull();
    });

    it('should respect court count limit', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          status: FixtureStatus.READY,
          order: 0,
        }),
        makeFixture({
          id: 'f2',
          teamAIndex: 2,
          teamBIndex: 3,
          status: FixtureStatus.READY,
          order: 1,
        }),
        makeFixture({
          id: 'f3',
          teamAIndex: 4,
          teamBIndex: 5,
          status: FixtureStatus.READY,
          order: 2,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      // Only 1 court available
      const result = await service.run('event-1', 25, 1);

      const liveFixtures = result.filter((f) => f.status === FixtureStatus.LIVE);
      // Only 1 court, so at most 1 fixture should be LIVE at a time.
      // However run() iterates multiple passes, so the first match could finish
      // via score check (but scores are 0, so it won't). Only 1 should be LIVE.
      expect(liveFixtures.length).toBe(1);
      expect(liveFixtures[0].courtIndex).toBe(0);
    });
  });

  describe('resolveFinishedByScore (via run)', () => {
    it('should mark a LIVE fixture as FINISHED when score reaches target', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          scoreA: 25,
          scoreB: 20,
          status: FixtureStatus.LIVE,
          courtIndex: 0,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 1);

      expect(result[0].status).toBe(FixtureStatus.FINISHED);
      expect(result[0].endedAt).not.toBeNull();
      expect(result[0].courtIndex).toBeNull();
    });

    it('should mark a READY fixture as FINISHED when score reaches target', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          scoreA: 10,
          scoreB: 25,
          status: FixtureStatus.READY,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 1);

      expect(result[0].status).toBe(FixtureStatus.FINISHED);
    });

    it('should NOT finish a fixture when both scores are below target', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          scoreA: 15,
          scoreB: 20,
          status: FixtureStatus.LIVE,
          courtIndex: 0,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 1);

      expect(result[0].status).toBe(FixtureStatus.LIVE);
    });

    it('should NOT finish a fixture when scores are tied at target', async () => {
      const fixtures = [
        makeFixture({
          id: 'f1',
          teamAIndex: 0,
          teamBIndex: 1,
          scoreA: 25,
          scoreB: 25,
          status: FixtureStatus.LIVE,
          courtIndex: 0,
        }),
      ];
      fixtureRepo.find.mockResolvedValue(fixtures);

      const result = await service.run('event-1', 25, 1);

      // Tied scores should not resolve
      expect(result[0].status).toBe(FixtureStatus.LIVE);
    });
  });
});
