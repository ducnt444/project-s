import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Schema as of the first deployment: users, trades and alerts. */
export class InitialSchema1762700000000 implements MigrationInterface {
  name = 'InitialSchema1762700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await q.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "display_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )`);
    await q.query(`
      CREATE TABLE "trades" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "symbol" character varying(20) NOT NULL,
        "side" character varying(4) NOT NULL,
        "quantity" numeric(20,6) NOT NULL,
        "price" numeric(20,6) NOT NULL,
        "fee" numeric(20,6) NOT NULL DEFAULT '0',
        "currency" character varying(3) NOT NULL DEFAULT 'USD',
        "executed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "source" character varying(10) NOT NULL DEFAULT 'manual',
        "note" character varying(500),
        "external_id" character varying(64),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c6d7c36a837411ba5194dc58595" PRIMARY KEY ("id")
      )`);
    await q.query(
      `CREATE INDEX "IDX_79389c8bdece72e6486ce0e19b" ON "trades" ("user_id", "executed_at")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "uq_trades_user_external_id" ON "trades" ("user_id", "external_id") WHERE external_id IS NOT NULL`,
    );
    await q.query(`
      CREATE TABLE "alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "symbol" character varying(20) NOT NULL,
        "condition" character varying(20) NOT NULL,
        "threshold" numeric(20,6) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "cooldown_minutes" integer NOT NULL DEFAULT 60,
        "one_shot" boolean NOT NULL DEFAULT false,
        "last_triggered_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id")
      )`);
    await q.query(
      `CREATE INDEX "IDX_f3b5748040fb851426315e9373" ON "alerts" ("active")`,
    );
    await q.query(
      `ALTER TABLE "trades" ADD CONSTRAINT "FK_4720ba843240e4403c292c32082" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "alerts" ADD CONSTRAINT "FK_f1eba840c1761991f142affee66" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "alerts"`);
    await q.query(`DROP TABLE "trades"`);
    await q.query(`DROP TABLE "users"`);
  }
}
