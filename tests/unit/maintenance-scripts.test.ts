import { describe, expect, it } from 'vitest';
import { parsePgUrl, pgEnv, timestamp, urlForDatabase } from '../../scripts/lib/pg';

describe('database maintenance helpers', () => {
  it('parses connection URLs and passes the password only through the environment', () => {
    const conn = parsePgUrl('postgresql://app%40x:p%40ss@db.host:6543/shymkent?schema=public&sslmode=require');
    expect(conn).toMatchObject({ host: 'db.host', port: '6543', user: 'app@x', password: 'p@ss', database: 'shymkent', sslmode: 'require' });
    const env = pgEnv(conn, 'restore_check_1');
    expect(env).toMatchObject({ PGHOST: 'db.host', PGPASSWORD: 'p@ss', PGDATABASE: 'restore_check_1', PGSSLMODE: 'require' });
    expect(urlForDatabase(conn, 'drift_check_1')).toBe('postgresql://app%40x:p%40ss@db.host:6543/drift_check_1?schema=public&sslmode=require');
  });
  it('rejects missing, foreign and suspicious URLs', () => {
    expect(() => parsePgUrl(undefined)).toThrow(/not set/);
    expect(() => parsePgUrl('mysql://u@h/db')).toThrow(/postgresql/);
    expect(() => parsePgUrl('postgresql://u@h/db;DROP')).toThrow(/database name/);
  });
  it('builds sortable UTC timestamps for backup file names', () => {
    expect(timestamp(new Date('2026-09-25T08:05:09Z'))).toBe('20260925-080509Z');
  });
});
