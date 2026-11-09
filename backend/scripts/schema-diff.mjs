// Applies all migrations to DATABASE_URL, then prints any SQL still needed to
// match the entities. Exits 1 when a migration is missing.
// Usage (after `npm run build`): DATABASE_URL=... npm run db:check
import { DataSource } from 'typeorm';
import { Alert } from '../dist/alerts/alert.entity.js';
import { MIGRATIONS } from '../dist/migrations/index.js';
import { Trade } from '../dist/trades/trade.entity.js';
import { User } from '../dist/users/user.entity.js';

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Trade, Alert],
  migrations: MIGRATIONS,
});
await ds.initialize();
await ds.runMigrations();
const { upQueries } = await ds.driver.createSchemaBuilder().log();
await ds.destroy();

if (upQueries.length) {
  console.error('Entities differ from the migrations. A new migration needs:\n');
  for (const q of upQueries) console.error(`${q.query};`);
  process.exit(1);
}
console.log('Migrations match the entities.');
