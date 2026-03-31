import { Allow } from 'class-validator';

/**
 * Choix d’équipe par le joueur (PATCH …/my-team).
 * Match simple : 0 | 1 | null. Tournoi : index 0..teamCount-1 | null. Validé dans MatchesService.
 */
export class UpdateMyTeamDto {
  /** Match simple : 0 = A, 1 = B. Tournoi : index d’équipe. null = sans équipe */
  @Allow()
  teamIndex!: number | null;
}
