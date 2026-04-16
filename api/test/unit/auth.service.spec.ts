import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';
import { SkillLevel, Position } from '../../src/common/enums';

// Mock bcryptjs
const mockHash = jest.fn();
const mockCompare = jest.fn();
jest.mock('bcryptjs', () => ({
  hash: (...args: unknown[]) => mockHash(...args),
  compare: (...args: unknown[]) => mockCompare(...args),
}));

describe('AuthService (unit)', () => {
  let service: AuthService;
  let userRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
    verify: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  const fakeUser = {
    id: 'user-uuid-1',
    username: 'player1',
    email: 'player1@example.com',
    passwordHash: 'hashed-password',
    skillLevel: SkillLevel.INTERMEDIATE,
    position: Position.SETTER,
    club: null,
    competition: null,
    league: null,
    profilePicture: null,
    bio: null,
    fcmToken: null,
    location: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'app.bcryptRounds') return 10;
        if (key === 'app.refreshTokenExpiresIn') return '7d';
        return undefined;
      }),
    };

    const emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      userRepo as any,
      jwtService as any,
      configService as any,
      emailService as any,
    );
  });

  describe('register', () => {
    it('should create a user with hashed password, return tokens and sanitized user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      mockHash.mockResolvedValue('hashed-pw' as any);
      userRepo.create.mockReturnValue({ ...fakeUser, passwordHash: 'hashed-pw' });
      userRepo.save.mockResolvedValue({ ...fakeUser, passwordHash: 'hashed-pw' });
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.register({
        username: 'player1',
        email: 'player1@example.com',
        password: 'mypassword123',
        skillLevel: SkillLevel.INTERMEDIATE,
        position: Position.SETTER,
      });

      expect(mockHash).toHaveBeenCalledWith('mypassword123', 10);
      expect(userRepo.create).toHaveBeenCalledWith({
        username: 'player1',
        email: 'player1@example.com',
        passwordHash: 'hashed-pw',
        skillLevel: SkillLevel.INTERMEDIATE,
        position: Position.SETTER,
      });
      expect(userRepo.save).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      // Sanitized user must not contain passwordHash
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toHaveProperty('email', 'player1@example.com');
      expect(result.user).toHaveProperty('id', 'user-uuid-1');
    });

    it('should throw ConflictException if email or username already exists', async () => {
      userRepo.findOne.mockResolvedValue(fakeUser);

      await expect(
        service.register({
          username: 'player1',
          email: 'player1@example.com',
          password: 'mypassword123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(userRepo.create).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return tokens and sanitized user for valid credentials', async () => {
      userRepo.findOne.mockResolvedValue(fakeUser);
      mockCompare.mockResolvedValue(true as any);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login({
        email: 'player1@example.com',
        password: 'mypassword123',
      });

      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: expect.anything(),
          }),
        }),
      );
      expect(mockCompare).toHaveBeenCalledWith('mypassword123', 'hashed-password');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toHaveProperty('id', 'user-uuid-1');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      userRepo.findOne.mockResolvedValue(fakeUser);
      mockCompare.mockResolvedValue(false as any);

      await expect(
        service.login({
          email: 'player1@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'ghost@example.com',
          password: 'anypassword',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockCompare).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new tokens for a valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-uuid-1', type: 'refresh' });
      userRepo.findOne.mockResolvedValue(fakeUser);
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshAccessToken('valid-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token');
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException for invalid token type (not refresh)', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-uuid-1', type: 'access' });

      await expect(
        service.refreshAccessToken('access-token-as-refresh'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired/invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.refreshAccessToken('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user no longer exists', async () => {
      jwtService.verify.mockReturnValue({ sub: 'deleted-user-id', type: 'refresh' });
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refreshAccessToken('valid-token-deleted-user'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sanitize (via register/login responses)', () => {
    it('should never expose passwordHash in register response', async () => {
      userRepo.findOne.mockResolvedValue(null);
      mockHash.mockResolvedValue('hashed-pw' as any);
      const savedUser = { ...fakeUser, passwordHash: 'hashed-pw' };
      userRepo.create.mockReturnValue(savedUser);
      userRepo.save.mockResolvedValue(savedUser);
      jwtService.sign.mockReturnValue('tok');

      const result = await service.register({
        username: 'player1',
        email: 'player1@example.com',
        password: 'mypassword123',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(Object.keys(result.user)).not.toContain('passwordHash');
    });

    it('should never expose passwordHash in login response', async () => {
      userRepo.findOne.mockResolvedValue(fakeUser);
      mockCompare.mockResolvedValue(true as any);
      jwtService.sign.mockReturnValue('tok');

      const result = await service.login({
        email: 'player1@example.com',
        password: 'mypassword123',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(Object.keys(result.user)).not.toContain('passwordHash');
    });
  });

  describe('generateTokens (via register)', () => {
    it('should sign access token with sub, email, and type=access', async () => {
      userRepo.findOne.mockResolvedValue(null);
      mockHash.mockResolvedValue('hashed-pw' as any);
      const savedUser = { ...fakeUser, passwordHash: 'hashed-pw' };
      userRepo.create.mockReturnValue(savedUser);
      userRepo.save.mockResolvedValue(savedUser);
      jwtService.sign.mockReturnValue('tok');

      await service.register({
        username: 'player1',
        email: 'player1@example.com',
        password: 'mypassword123',
      });

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-uuid-1',
        email: 'player1@example.com',
        type: 'access',
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-uuid-1', type: 'refresh' },
        { expiresIn: '7d' },
      );
    });
  });
});
