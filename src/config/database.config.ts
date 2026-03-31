import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url:
    process.env.DATABASE_URL ??
    'postgresql://volley:volley_secret@localhost:5432/volleyfinder',
}));
