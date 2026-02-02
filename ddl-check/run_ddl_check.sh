#!/usr/bin/env bash
# ddl-check/run_ddl_check.sh
set -euo pipefail

COMPOSE="docker compose -f docker-compose.ddlcheck.yml"

echo "[1/3] Postgres: apply /scripts/postgres.sql"
$COMPOSE exec -T pg_ddl sh -lc "psql -U postgres -d ddlcheck -v ON_ERROR_STOP=1 -f /scripts/postgres.sql"
echo "OK: Postgres"

echo "[2/3] MySQL: wait + apply /scripts/mysql.sql"
$COMPOSE exec -T mysql_ddl sh -lc "mysqladmin ping -uroot -proot --silent"
# ВАЖНО: без указания базы, потому что скрипт делает DROP/CREATE/USE ddlcheck
$COMPOSE exec -T mysql_ddl sh -lc "mysql -uroot -proot < /scripts/mysql.sql"
echo "OK: MySQL"

echo "[3/3] SQLite: apply /scripts/sqlite.sql"
$COMPOSE exec -T sqlite_ddl sh -lc "sqlite3 -bail /db/ddlcheck.sqlite < /scripts/sqlite.sql"
echo "OK: SQLite"

echo "PASS: all DDL scripts applied successfully"
