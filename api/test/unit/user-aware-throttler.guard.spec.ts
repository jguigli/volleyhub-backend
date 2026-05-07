import { UserAwareThrottlerGuard } from '../../src/common/guards/user-aware-throttler.guard';

describe('UserAwareThrottlerGuard (unit)', () => {
  let guard: UserAwareThrottlerGuard;
  let jwtVerify: jest.Mock;
  let configGet: jest.Mock;

  beforeEach(() => {
    jwtVerify = jest.fn();
    configGet = jest.fn().mockReturnValue('test-secret');
    // Bypass DI: the guard's getTracker only uses jwt, config and req.headers
    guard = Object.create(UserAwareThrottlerGuard.prototype) as UserAwareThrottlerGuard;
    (guard as any).jwt = { verify: jwtVerify };
    (guard as any).config = { get: configGet };
  });

  // getTracker is protected — access via prototype for tests.
  const callGetTracker = (req: any): Promise<string> =>
    (guard as unknown as { getTracker: (r: any) => Promise<string> }).getTracker(req);

  it('returns user:<sub> when Authorization header has a valid Bearer token', async () => {
    jwtVerify.mockReturnValue({ sub: 'user-123' });
    const req = { headers: { authorization: 'Bearer abc.def.ghi' }, ip: '1.2.3.4' };

    expect(await callGetTracker(req)).toBe('user:user-123');
    expect(jwtVerify).toHaveBeenCalledWith('abc.def.ghi', { secret: 'test-secret' });
  });

  it('falls back to ip:<addr> when there is no Authorization header', async () => {
    const req = { headers: {}, ip: '1.2.3.4' };
    expect(await callGetTracker(req)).toBe('ip:1.2.3.4');
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('falls back to ip when the token is malformed', async () => {
    const req = { headers: { authorization: 'NotABearer xyz' }, ip: '5.6.7.8' };
    expect(await callGetTracker(req)).toBe('ip:5.6.7.8');
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it('falls back to ip when JWT verification throws (expired/invalid)', async () => {
    jwtVerify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const req = { headers: { authorization: 'Bearer expired.token' }, ip: '5.6.7.8' };
    expect(await callGetTracker(req)).toBe('ip:5.6.7.8');
  });

  it('falls back to ip:unknown when no header and no ip', async () => {
    expect(await callGetTracker({ headers: {} })).toBe('ip:unknown');
  });

  it('two different users on the same IP get different trackers', async () => {
    jwtVerify
      .mockReturnValueOnce({ sub: 'a' })
      .mockReturnValueOnce({ sub: 'b' });

    const a = await callGetTracker({ headers: { authorization: 'Bearer t1' }, ip: '10.0.0.1' });
    const b = await callGetTracker({ headers: { authorization: 'Bearer t2' }, ip: '10.0.0.1' });

    expect(a).toBe('user:a');
    expect(b).toBe('user:b');
  });
});
