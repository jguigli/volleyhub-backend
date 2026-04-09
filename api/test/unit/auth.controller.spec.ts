import { AuthController } from '../../src/modules/auth/auth.controller';
import { RegisterDto } from '../../src/modules/auth/dto/register.dto';
import { LoginDto } from '../../src/modules/auth/dto/login.dto';
import { SkillLevel, Position } from '../../src/common/enums';

describe('AuthController (unit)', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refreshAccessToken: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      register: jest.fn().mockResolvedValue({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
        user: { id: 'u1', email: 'a@b.c' },
      }),
      login: jest.fn().mockResolvedValue({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
        user: { id: 'u1', email: 'a@b.c' },
      }),
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      }),
    };
    controller = new AuthController(authService as any);
  });

  describe('register', () => {
    it('should delegate to authService.register with the exact dto', async () => {
      const dto: RegisterDto = {
        username: 'player1',
        email: 'player1@example.com',
        password: 'securePassword123',
        skillLevel: SkillLevel.INTERMEDIATE,
        position: Position.SETTER,
      };

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledTimes(1);
      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
        user: { id: 'u1', email: 'a@b.c' },
      });
    });

    it('should pass through dto without optional fields', async () => {
      const dto: RegisterDto = {
        username: 'player2',
        email: 'player2@example.com',
        password: 'securePassword123',
      };

      await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should delegate to authService.login with the exact dto', async () => {
      const dto: LoginDto = {
        email: 'player1@example.com',
        password: 'securePassword123',
      };

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledTimes(1);
      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
        user: { id: 'u1', email: 'a@b.c' },
      });
    });
  });

  describe('refresh', () => {
    it('should delegate to authService.refreshAccessToken with the refreshToken string', async () => {
      const refreshToken = 'my-refresh-token-string';

      const result = await controller.refresh(refreshToken);

      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });

    it('should pass through the exact token string value', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-payload.signature';

      await controller.refresh(token);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith(token);
    });
  });
});
