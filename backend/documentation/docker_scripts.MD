# Docker Commands Reference

## Starting and stopping

`docker compose up -d`
Start all services defined in docker-compose.yml in the background (db + pgadmin).

`docker compose up -d db mailpit`
Start only the `db` service (PostgreSQL) and mailpit. Useful when you don't need pgadmin.

`docker compose down`
Stop and remove all containers. Data is preserved in the volume.

`docker compose down -v`
Stop and remove all containers **and** delete the volume. Wipes all data and forces the container to re-run `schema.sql` on next startup. Use this when you change the schema.

---

## Inspecting state

`docker compose ps`
List running containers and their status.

`docker compose logs db`
Print the PostgreSQL container logs. Useful to confirm schema.sql ran without errors on startup.

`docker compose logs -f db`
Same as above but follows live (like `tail -f`). Useful to watch startup in real time.

---

## Connecting to the database

`docker compose exec db psql -U <user> -d <dbname>`
Open an interactive psql shell inside the running container. Replace `<user>` and `<dbname>` with the values from your `.env` (`POSTGRES_USER`, `POSTGRES_DB`).

---

## Resetting / rebuilding

`docker compose down -v && docker compose up -d db`
Full reset in one line — wipes the volume and starts fresh. Run this any time you change `schema.sql`.

`docker compose pull`
Pull the latest image versions defined in docker-compose.yml (e.g. `postgres:16`).

---

## pgAdmin

Starts alongside `db` when you run `docker compose up -d`.
Available at `http://localhost:5050` in the browser.
Login credentials are in your `.env` (`PGADMIN_EMAIL`, `PGADMIN_PASSWORD`).
To connect to the database inside pgAdmin, use `db` as the hostname (the Docker service name), port `5432`.