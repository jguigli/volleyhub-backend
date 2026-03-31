import { AuthController } from '../../src/modules/auth/auth.controller';

describe('AuthController (unit)', () => {
  it('delegates register/login to AuthService', async () => {
    const authService = {
      register: jest.fn().mockResolvedValue({ id: 'u1' }),
      login: jest.fn().mockResolvedValue({ accessToken: 'token' }),
    };
    const controller = new AuthController(authService as any);

    await controller.register({ email: 'a@b.c' } as any);
    await controller.login({ email: 'a@b.c' } as any);

    expect(authService.register).toHaveBeenCalledTimes(1);
    expect(authService.login).toHaveBeenCalledTimes(1);
  });
});
