import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    allowedOrigins: process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    },
  };
});
