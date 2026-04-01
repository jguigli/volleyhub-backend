import { TournamentGeneratorService } from '../../src/modules/matches/tournament-generator.service';
import { FixtureStatus } from '../../src/modules/matches/tournament-fixture.entity';
import { TournamentSystem } from '../../src/common/enums';

describe('TournamentGeneratorService (unit)', () => {
  let service: TournamentGeneratorService;

  beforeEach(() => {
    service = new TournamentGeneratorService();
  });

  describe('minimum team count', () => {
    it('should return empty array for 0 teams', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 0);
      expect(rows).toEqual([]);
    });

    it('should return empty array for 1 team', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 1);
      expect(rows).toEqual([]);
    });

    it('should return empty array for 2 teams', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 2);
      expect(rows).toEqual([]);
    });

    it('should return fixtures for 3 teams', () => {
      const rows = service.generateRows(TournamentSystem.ROUND_ROBIN, 3);
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe('singleElimination', () => {
    it('should generate correct number of fixtures for 4 teams (3 fixtures)', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 4);
      // 4 teams = bracket of 4: 2 semis + 1 final = 3 fixtures
      expect(rows).toHaveLength(3);
    });

    it('should generate correct number of fixtures for 8 teams (7 fixtures)', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 8);
      // 8 teams: 4 + 2 + 1 = 7 fixtures
      expect(rows).toHaveLength(7);
    });

    it('should generate correct number of fixtures for 16 teams (15 fixtures)', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 16);
      // 16 teams: 8 + 4 + 2 + 1 = 15 fixtures
      expect(rows).toHaveLength(15);
    });

    it('should have team indices in the first round fixtures', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 4);
      const round0 = rows.filter((r) => r.round === 0);

      // First round should have actual team indices
      expect(round0.length).toBe(2);
      for (const fixture of round0) {
        expect(fixture.teamAIndex).not.toBeNull();
        expect(fixture.teamBIndex).not.toBeNull();
      }
    });

    it('should have null teams in later rounds (pending winners)', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 4);
      const round1 = rows.filter((r) => r.round === 1);

      // Final should have null teams (waiting for semi winners)
      expect(round1.length).toBe(1);
      expect(round1[0].teamAIndex).toBeNull();
      expect(round1[0].teamBIndex).toBeNull();
    });

    it('should set READY status for first round fixtures with both teams', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 4);
      const round0 = rows.filter((r) => r.round === 0);

      for (const fixture of round0) {
        expect(fixture.status).toBe(FixtureStatus.READY);
      }
    });

    it('should set PENDING status for later round fixtures with dependencies', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 4);
      const round1 = rows.filter((r) => r.round === 1);

      for (const fixture of round1) {
        expect(fixture.status).toBe(FixtureStatus.PENDING);
      }
    });

    it('should handle non-power-of-2 (6 teams -> 8 bracket with byes)', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 6);
      // Bracket size = 8: 4 + 2 + 1 = 7 fixtures
      expect(rows).toHaveLength(7);

      const round0 = rows.filter((r) => r.round === 0);
      expect(round0).toHaveLength(4);

      // With 6 teams in an 8-bracket, some first-round fixtures have null teams (byes)
      const byes = round0.filter(
        (f) => f.teamAIndex === null || f.teamBIndex === null,
      );
      expect(byes.length).toBeGreaterThanOrEqual(1); // at least 1 bye slot
    });

    it('should set feedsFixtureId and feedsSlot for first round fixtures', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 4);
      const round0 = rows.filter((r) => r.round === 0);

      for (const fixture of round0) {
        expect(fixture.feedsFixtureId).not.toBeNull();
        expect(['A', 'B']).toContain(fixture.feedsSlot);
      }
    });

    it('should have unique ids for all fixtures', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 8);
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should set dependsOnFixtureIds for later rounds', () => {
      const rows = service.generateRows(TournamentSystem.SINGLE_ELIMINATION, 4);
      const round1 = rows.filter((r) => r.round === 1);

      expect(round1[0].dependsOnFixtureIds).not.toBeNull();
      expect(round1[0].dependsOnFixtureIds).toHaveLength(2);
    });
  });

  describe('roundRobin', () => {
    it('should generate n*(n-1)/2 fixtures for n teams', () => {
      const testCases = [
        { teams: 3, expected: 3 },
        { teams: 4, expected: 6 },
        { teams: 5, expected: 10 },
        { teams: 6, expected: 15 },
      ];

      for (const { teams, expected } of testCases) {
        const rows = service.generateRows(TournamentSystem.ROUND_ROBIN, teams);
        expect(rows).toHaveLength(expected);
      }
    });

    it('should have all fixtures start as READY', () => {
      const rows = service.generateRows(TournamentSystem.ROUND_ROBIN, 4);

      for (const fixture of rows) {
        expect(fixture.status).toBe(FixtureStatus.READY);
      }
    });

    it('should have no dependencies in round robin', () => {
      const rows = service.generateRows(TournamentSystem.ROUND_ROBIN, 4);

      for (const fixture of rows) {
        expect(fixture.dependsOnFixtureIds).toBeNull();
        expect(fixture.feedsFixtureId).toBeNull();
        expect(fixture.feedsSlot).toBeNull();
      }
    });

    it('should have all team pairs represented exactly once', () => {
      const rows = service.generateRows(TournamentSystem.ROUND_ROBIN, 4);
      const pairs = new Set<string>();

      for (const f of rows) {
        const pair = `${f.teamAIndex}-${f.teamBIndex}`;
        expect(pairs.has(pair)).toBe(false);
        pairs.add(pair);
      }

      // Verify all combinations exist
      expect(pairs.size).toBe(6);
    });

    it('should have all fixtures on round 0', () => {
      const rows = service.generateRows(TournamentSystem.ROUND_ROBIN, 5);

      for (const fixture of rows) {
        expect(fixture.round).toBe(0);
      }
    });

    it('should have sequential order values', () => {
      const rows = service.generateRows(TournamentSystem.ROUND_ROBIN, 4);
      const orders = rows.map((r) => r.order).sort((a, b) => a - b);

      expect(orders).toEqual(Array.from({ length: rows.length }, (_, i) => i));
    });

    it('should initialize scores to 0', () => {
      const rows = service.generateRows(TournamentSystem.ROUND_ROBIN, 4);

      for (const fixture of rows) {
        expect(fixture.scoreA).toBe(0);
        expect(fixture.scoreB).toBe(0);
      }
    });
  });

  describe('poolsAndFinals', () => {
    it('should generate pool_a, pool_b, and finals fixtures', () => {
      const rows = service.generateRows(TournamentSystem.POOLS_FINALS, 6);

      const phases = new Set(rows.map((r) => r.phase));
      expect(phases).toContain('pool_a');
      expect(phases).toContain('pool_b');
      expect(phases).toContain('finals');
    });

    it('should split teams evenly across two pools', () => {
      const rows = service.generateRows(TournamentSystem.POOLS_FINALS, 6);

      const poolA = rows.filter((r) => r.phase === 'pool_a');
      const poolB = rows.filter((r) => r.phase === 'pool_b');

      // 6 teams: pool A gets 3 teams (3 fixtures), pool B gets 3 teams (3 fixtures)
      expect(poolA).toHaveLength(3); // C(3,2) = 3
      expect(poolB).toHaveLength(3); // C(3,2) = 3
    });

    it('should have pool fixtures as READY', () => {
      const rows = service.generateRows(TournamentSystem.POOLS_FINALS, 6);

      const poolFixtures = rows.filter(
        (r) => r.phase === 'pool_a' || r.phase === 'pool_b',
      );
      for (const f of poolFixtures) {
        expect(f.status).toBe(FixtureStatus.READY);
      }
    });

    it('should have finals fixture as PENDING', () => {
      const rows = service.generateRows(TournamentSystem.POOLS_FINALS, 6);

      const finals = rows.filter((r) => r.phase === 'finals');
      expect(finals).toHaveLength(1);
      expect(finals[0].status).toBe(FixtureStatus.PENDING);
    });

    it('should have finals with null team indices (awaiting pool results)', () => {
      const rows = service.generateRows(TournamentSystem.POOLS_FINALS, 6);

      const finals = rows.filter((r) => r.phase === 'finals');
      expect(finals[0].teamAIndex).toBeNull();
      expect(finals[0].teamBIndex).toBeNull();
    });

    it('should have finals on a later round than pool fixtures', () => {
      const rows = service.generateRows(TournamentSystem.POOLS_FINALS, 6);

      const poolFixtures = rows.filter(
        (r) => r.phase === 'pool_a' || r.phase === 'pool_b',
      );
      const finals = rows.filter((r) => r.phase === 'finals');

      const maxPoolRound = Math.max(...poolFixtures.map((f) => f.round));
      expect(finals[0].round).toBeGreaterThan(maxPoolRound);
    });

    it('should handle odd number of teams (5 teams)', () => {
      const rows = service.generateRows(TournamentSystem.POOLS_FINALS, 5);

      const poolA = rows.filter((r) => r.phase === 'pool_a');
      const poolB = rows.filter((r) => r.phase === 'pool_b');

      // 5 teams: pool A gets ceil(5/2)=3 teams (3 fixtures), pool B gets 2 teams (1 fixture)
      expect(poolA).toHaveLength(3); // C(3,2)
      expect(poolB).toHaveLength(1); // C(2,2)
    });

    it('should have unique ids across all fixtures', () => {
      const rows = service.generateRows(TournamentSystem.POOLS_FINALS, 8);
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('default system fallback', () => {
    it('should fall back to singleElimination for unknown system', () => {
      const rows = service.generateRows('unknown_system' as any, 4);
      // Should behave like single elimination: 3 fixtures for 4 teams
      expect(rows).toHaveLength(3);
    });
  });
});
