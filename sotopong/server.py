"""
SotoPong — Backend v2.0 (PostgreSQL)
FastAPI + PostgreSQL

Запуск:
  pip install fastapi uvicorn python-multipart psycopg2-binary
  DATABASE_URL=postgresql://user:pass@localhost:5432/sotopong python server.py
"""

import os, glob, json
from datetime import datetime
from typing import Optional
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import errors as pg_errors

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sotopong:sotopong@localhost:5432/sotopong"
)
STATIC_DIR  = "static"
AVATARS_DIR = "avatars"
INITIAL_ELO = 1000
K_FACTOR    = 32

app = FastAPI(title="SotoPong API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
os.makedirs(AVATARS_DIR, exist_ok=True)


# ── Database ──────────────────────────────────────────────────────────────────
@contextmanager
def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _column_exists(conn, table: str, column: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.columns WHERE table_name=%s AND column_name=%s",
            (table, column)
        )
        return bool(cur.fetchone())


def init_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id         SERIAL PRIMARY KEY,
                name       TEXT NOT NULL UNIQUE,
                rating     INTEGER NOT NULL DEFAULT 1000,
                wins       INTEGER NOT NULL DEFAULT 0,
                losses     INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id        SERIAL PRIMARY KEY,
                p1        TEXT NOT NULL,
                p2        TEXT NOT NULL,
                p1b       TEXT,
                p2b       TEXT,
                s1        INTEGER NOT NULL,
                s2        INTEGER NOT NULL,
                winner    TEXT NOT NULL,
                d1        INTEGER NOT NULL,
                d2        INTEGER NOT NULL,
                played_at TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tournaments (
                id           SERIAL PRIMARY KEY,
                name         TEXT    NOT NULL,
                status       TEXT    NOT NULL DEFAULT 'active',
                prize_mode   TEXT    NOT NULL DEFAULT 'winner_takes_all',
                bet_type     TEXT    NOT NULL DEFAULT 'money',
                winner_name  TEXT,
                second_name  TEXT,
                third_name   TEXT,
                bracket_json TEXT,
                created_at   TEXT    NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tournament_players (
                id              SERIAL PRIMARY KEY,
                tournament_id   INTEGER NOT NULL REFERENCES tournaments(id),
                player_name     TEXT    NOT NULL,
                bet             INTEGER NOT NULL DEFAULT 0,
                rating_delta    INTEGER NOT NULL DEFAULT 0,
                finish_place    INTEGER
            )
        """)
        conn.commit()

        # Migrations
        migrations = [
            ("matches",            "p1b",          "ALTER TABLE matches ADD COLUMN p1b TEXT"),
            ("matches",            "p2b",          "ALTER TABLE matches ADD COLUMN p2b TEXT"),
            ("tournaments",        "prize_mode",   "ALTER TABLE tournaments ADD COLUMN prize_mode TEXT NOT NULL DEFAULT 'winner_takes_all'"),
            ("tournaments",        "second_name",  "ALTER TABLE tournaments ADD COLUMN second_name TEXT"),
            ("tournaments",        "third_name",   "ALTER TABLE tournaments ADD COLUMN third_name TEXT"),
            ("tournaments",        "bracket_json", "ALTER TABLE tournaments ADD COLUMN bracket_json TEXT"),
            ("tournaments",        "bet_type",     "ALTER TABLE tournaments ADD COLUMN bet_type TEXT NOT NULL DEFAULT 'money'"),
            ("tournament_players", "rating_delta", "ALTER TABLE tournament_players ADD COLUMN rating_delta INTEGER NOT NULL DEFAULT 0"),
            ("tournament_players", "finish_place", "ALTER TABLE tournament_players ADD COLUMN finish_place INTEGER"),
        ]
        for table, column, sql in migrations:
            if not _column_exists(conn, table, column):
                cur.execute(sql)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


init_db()


# ── Helpers ───────────────────────────────────────────────────────────────────
def calc_elo(ra, rb, sa, sb):
    exp_a = 1 / (1 + 10 ** ((rb - ra) / 400))
    act_a = 1 if sa > sb else (0.5 if sa == sb else 0)
    da = round(K_FACTOR * (act_a - exp_a))
    db = round(K_FACTOR * ((1 - act_a) - (1 - exp_a)))
    return ra + da, rb + db, da, db


def fmt_match(m: dict) -> dict:
    try:
        dt = datetime.fromisoformat(m["played_at"])
        m["date"] = dt.strftime("%d.%m.%Y")
        m["time"] = dt.strftime("%H:%M")
    except Exception:
        m["date"] = m.get("played_at", "")
        m["time"] = ""
    return m


def find_avatar(player_id: int) -> Optional[str]:
    files = glob.glob(os.path.join(AVATARS_DIR, f"{player_id}.*"))
    return files[0] if files else None


def player_to_dict(row) -> dict:
    p = dict(row)
    p["avatar_url"] = f"/api/players/{p['id']}/avatar" if find_avatar(p["id"]) else None
    return p


def get_tournament_dict(conn, tid: int) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM tournaments WHERE id=%s", (tid,))
        t = cur.fetchone()
        if not t:
            return None
        d = dict(t)
        cur.execute(
            "SELECT * FROM tournament_players WHERE tournament_id=%s ORDER BY id",
            (tid,)
        )
        rows = cur.fetchall()
        d["players"] = [dict(p) for p in rows]
        d["prize_pool"] = sum(p["bet"] for p in d["players"])
    return d


# ── Schemas ───────────────────────────────────────────────────────────────────
class PlayerCreate(BaseModel):
    name: str

class MatchCreate(BaseModel):
    p1_name:  str
    p2_name:  str
    score1:   int
    score2:   int
    p1b_name: Optional[str] = None
    p2b_name: Optional[str] = None

class TournamentCreate(BaseModel):
    name: str
    prize_mode: str = "winner_takes_all"
    bet_type: str = "money"

class TournamentPlayerAdd(BaseModel):
    player_name: str
    bet: int

class TournamentBracketSave(BaseModel):
    bracket_json: str

class TournamentFinish(BaseModel):
    winner_name: str
    second_name: Optional[str] = None
    third_name:  Optional[str] = None
    bracket_json: Optional[str] = None
    # Map player_name -> rating_delta (calculated by frontend)
    rounds_won: Optional[dict] = None


# ── Players ───────────────────────────────────────────────────────────────────
@app.get("/api/players")
def get_players():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM players ORDER BY rating DESC")
            rows = cur.fetchall()
    return [player_to_dict(r) for r in rows]


@app.post("/api/players", status_code=201)
def create_player(body: PlayerCreate):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Имя не может быть пустым")
    with get_db() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO players (name, rating, wins, losses) VALUES (%s, %s, 0, 0) RETURNING id",
                    (name, INITIAL_ELO)
                )
                new_id = cur.fetchone()["id"]
                cur.execute("SELECT * FROM players WHERE id=%s", (new_id,))
                row = cur.fetchone()
        except pg_errors.UniqueViolation:
            raise HTTPException(409, f"Игрок «{name}» уже существует")
    return player_to_dict(row)


@app.delete("/api/players/{player_id}")
def delete_player(player_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM players WHERE id=%s", (player_id,))
            player = cur.fetchone()
            if not player:
                raise HTTPException(404, "Игрок не найден")
            name = player["name"]
            cur.execute(
                "SELECT * FROM matches WHERE p1=%s OR p2=%s OR p1b=%s OR p2b=%s",
                (name, name, name, name)
            )
            rows = cur.fetchall()
            for row in rows:
                m = dict(row)
                is_2v2 = bool(m.get("p1b"))
                team1_won = m["winner"] == m["p1"]
                pairs = (
                    [(m["p1"], m["d1"], team1_won), (m["p1b"], m["d1"], team1_won),
                     (m["p2"], m["d2"], not team1_won), (m["p2b"], m["d2"], not team1_won)]
                    if is_2v2 else
                    [(m["p1"], m["d1"], m["winner"] == m["p1"]),
                     (m["p2"], m["d2"], m["winner"] == m["p2"])]
                )
                for pname, delta, won in pairs:
                    if pname and pname != name:
                        cur.execute(
                            "UPDATE players SET rating=rating-%s, wins=wins-%s, losses=losses-%s WHERE name=%s",
                            (delta, 1 if won else 0, 0 if won else 1, pname)
                        )
            cur.execute("DELETE FROM matches WHERE p1=%s OR p2=%s OR p1b=%s OR p2b=%s",
                        (name, name, name, name))
            cur.execute("DELETE FROM players WHERE id=%s", (player_id,))
    av = find_avatar(player_id)
    if av:
        try: os.remove(av)
        except: pass
    return {"ok": True}


# ── Avatar ────────────────────────────────────────────────────────────────────
@app.post("/api/players/{player_id}/avatar")
async def upload_avatar(player_id: int, file: UploadFile = File(...)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM players WHERE id=%s", (player_id,))
            if not cur.fetchone():
                raise HTTPException(404, "Игрок не найден")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Файл должен быть изображением")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "gif", "webp", "avif"}:
        ext = "jpg"
    old = find_avatar(player_id)
    if old:
        try: os.remove(old)
        except: pass
    path = os.path.join(AVATARS_DIR, f"{player_id}.{ext}")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "Файл слишком большой (макс. 5 МБ)")
    with open(path, "wb") as f:
        f.write(content)
    return {"ok": True, "avatar_url": f"/api/players/{player_id}/avatar"}


@app.get("/api/players/{player_id}/avatar")
def get_avatar(player_id: int):
    path = find_avatar(player_id)
    if not path:
        raise HTTPException(404, "Аватар не найден")
    return FileResponse(path)


# ── Matches ───────────────────────────────────────────────────────────────────
@app.get("/api/matches")
def get_matches():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM matches ORDER BY id DESC")
            rows = cur.fetchall()
    return [fmt_match(dict(r)) for r in rows]


@app.post("/api/matches", status_code=201)
def create_match(body: MatchCreate):
    if body.score1 == body.score2:
        raise HTTPException(400, "Ничья не допускается")
    if body.score1 < 0 or body.score2 < 0:
        raise HTTPException(400, "Счёт не может быть отрицательным")
    is_2v2 = bool(body.p1b_name and body.p2b_name)
    with get_db() as conn:
        with conn.cursor() as cur:
            def gp(name):
                cur.execute("SELECT * FROM players WHERE name=%s", (name,))
                p = cur.fetchone()
                if not p: raise HTTPException(404, f"Игрок «{name}» не найден")
                return p
            pl1 = gp(body.p1_name); pl2 = gp(body.p2_name)
            winner = body.p1_name if body.score1 > body.score2 else body.p2_name
            team1_won = body.score1 > body.score2
            if is_2v2:
                pl1b = gp(body.p1b_name); pl2b = gp(body.p2b_name)
                avg1 = (pl1["rating"] + pl1b["rating"]) // 2
                avg2 = (pl2["rating"] + pl2b["rating"]) // 2
                _, _, d1, d2 = calc_elo(avg1, avg2, body.score1, body.score2)
                for p, d, won in [(pl1, d1, team1_won), (pl1b, d1, team1_won),
                                  (pl2, d2, not team1_won), (pl2b, d2, not team1_won)]:
                    cur.execute(
                        "UPDATE players SET rating=rating+%s, wins=wins+%s, losses=losses+%s WHERE id=%s",
                        (d, 1 if won else 0, 0 if won else 1, p["id"])
                    )
                cur.execute(
                    "INSERT INTO matches (p1,p2,p1b,p2b,s1,s2,winner,d1,d2) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (body.p1_name, body.p2_name, body.p1b_name, body.p2b_name,
                     body.score1, body.score2, winner, d1, d2)
                )
            else:
                _, _, d1, d2 = calc_elo(pl1["rating"], pl2["rating"], body.score1, body.score2)
                cur.execute(
                    "UPDATE players SET rating=rating+%s, wins=wins+%s, losses=losses+%s WHERE id=%s",
                    (d1, 1 if team1_won else 0, 0 if team1_won else 1, pl1["id"])
                )
                cur.execute(
                    "UPDATE players SET rating=rating+%s, wins=wins+%s, losses=losses+%s WHERE id=%s",
                    (d2, 0 if team1_won else 1, 1 if team1_won else 0, pl2["id"])
                )
                cur.execute(
                    "INSERT INTO matches (p1,p2,s1,s2,winner,d1,d2) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                    (body.p1_name, body.p2_name, body.score1, body.score2, winner, d1, d2)
                )
            new_id = cur.fetchone()["id"]
            cur.execute("SELECT * FROM matches WHERE id=%s", (new_id,))
            row = cur.fetchone()
    return fmt_match(dict(row))


@app.delete("/api/matches/{match_id}")
def delete_match(match_id: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM matches WHERE id=%s", (match_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Матч не найден")
            m = dict(row)
            is_2v2 = bool(m.get("p1b"))
            team1_won = m["winner"] == m["p1"]
            pairs = (
                [(m["p1"], m["d1"], team1_won), (m["p1b"], m["d1"], team1_won),
                 (m["p2"], m["d2"], not team1_won), (m["p2b"], m["d2"], not team1_won)]
                if is_2v2 else
                [(m["p1"], m["d1"], m["winner"] == m["p1"]),
                 (m["p2"], m["d2"], m["winner"] == m["p2"])]
            )
            for pname, delta, won in pairs:
                if pname:
                    cur.execute(
                        "UPDATE players SET rating=rating-%s, wins=wins-%s, losses=losses-%s WHERE name=%s",
                        (delta, 1 if won else 0, 0 if won else 1, pname)
                    )
            cur.execute("DELETE FROM matches WHERE id=%s", (match_id,))
    return {"ok": True}


# ── Tournaments ───────────────────────────────────────────────────────────────
@app.get("/api/tournaments")
def get_tournaments():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tournaments ORDER BY id DESC")
            rows = cur.fetchall()
        return [get_tournament_dict(conn, r["id"]) for r in rows]


@app.post("/api/tournaments", status_code=201)
def create_tournament(body: TournamentCreate):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Название не может быть пустым")
    prize_mode = body.prize_mode if body.prize_mode in ("winner_takes_all", "top3_split") else "winner_takes_all"
    bet_type = body.bet_type if body.bet_type in ("money", "points") else "money"
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO tournaments (name, prize_mode, bet_type) VALUES (%s,%s,%s) RETURNING id",
                (name, prize_mode, bet_type)
            )
            new_id = cur.fetchone()["id"]
        return get_tournament_dict(conn, new_id)


@app.delete("/api/tournaments/{tid}")
def delete_tournament(tid: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM tournaments WHERE id=%s", (tid,))
            if not cur.fetchone():
                raise HTTPException(404, "Турнир не найден")
            cur.execute("DELETE FROM tournament_players WHERE tournament_id=%s", (tid,))
            cur.execute("DELETE FROM tournaments WHERE id=%s", (tid,))
    return {"ok": True}


@app.post("/api/tournaments/{tid}/players", status_code=201)
def add_tournament_player(tid: int, body: TournamentPlayerAdd):
    if body.bet < 0:
        raise HTTPException(400, "Ставка не может быть отрицательной")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tournaments WHERE id=%s", (tid,))
            t = cur.fetchone()
            if not t:
                raise HTTPException(404, "Турнир не найден")
            if dict(t)["status"] != "active":
                raise HTTPException(400, "Турнир уже завершён")
            name = body.player_name.strip()
            cur.execute(
                "SELECT id FROM tournament_players WHERE tournament_id=%s AND player_name=%s",
                (tid, name)
            )
            if cur.fetchone():
                raise HTTPException(409, f"Игрок «{name}» уже в турнире")
            cur.execute(
                "INSERT INTO tournament_players (tournament_id, player_name, bet) VALUES (%s,%s,%s)",
                (tid, name, body.bet)
            )
        return get_tournament_dict(conn, tid)


@app.delete("/api/tournaments/{tid}/players/{pid}")
def remove_tournament_player(tid: int, pid: int):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT status FROM tournaments WHERE id=%s", (tid,))
            t = cur.fetchone()
            if not t or dict(t)["status"] != "active":
                raise HTTPException(400, "Нельзя изменить завершённый турнир")
            cur.execute(
                "SELECT id FROM tournament_players WHERE id=%s AND tournament_id=%s",
                (pid, tid)
            )
            if not cur.fetchone():
                raise HTTPException(404, "Игрок не найден")
            cur.execute("DELETE FROM tournament_players WHERE id=%s", (pid,))
    return {"ok": True}


@app.post("/api/tournaments/{tid}/bracket")
def save_bracket(tid: int, body: TournamentBracketSave):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT status FROM tournaments WHERE id=%s", (tid,))
            if not cur.fetchone():
                raise HTTPException(404, "Турнир не найден")
            cur.execute("UPDATE tournaments SET bracket_json=%s WHERE id=%s",
                        (body.bracket_json, tid))
    return {"ok": True}


@app.post("/api/tournaments/{tid}/finish")
def finish_tournament(tid: int, body: TournamentFinish):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tournaments WHERE id=%s", (tid,))
            t = cur.fetchone()
            if not t:
                raise HTTPException(404, "Турнир не найден")
            td = dict(t)
            if td["status"] != "active":
                raise HTTPException(400, "Турнир уже завершён")
            cur.execute(
                "SELECT id FROM tournament_players WHERE tournament_id=%s AND player_name=%s",
                (tid, body.winner_name)
            )
            if not cur.fetchone():
                raise HTTPException(400, "Победитель не найден в турнире")

            cur.execute("SELECT * FROM tournament_players WHERE tournament_id=%s", (tid,))
            players_rows = cur.fetchall()

            # Use frontend-calculated rating deltas directly
            rating_deltas = body.rounds_won or {}

            place_map = {}
            if body.winner_name: place_map[body.winner_name] = 1
            if body.second_name: place_map[body.second_name] = 2
            if body.third_name:  place_map[body.third_name]  = 3

            for p in players_rows:
                name = p["player_name"]
                delta = rating_deltas.get(name, 0)
                place = place_map.get(name)

                if delta != 0:
                    cur.execute("UPDATE players SET rating=rating+%s WHERE name=%s", (delta, name))
                cur.execute(
                    "UPDATE tournament_players SET rating_delta=%s, finish_place=%s "
                    "WHERE tournament_id=%s AND player_name=%s",
                    (delta, place, tid, name)
                )

            bj = body.bracket_json or td.get("bracket_json")
            cur.execute(
                "UPDATE tournaments SET status='finished', winner_name=%s, second_name=%s, "
                "third_name=%s, bracket_json=%s WHERE id=%s",
                (body.winner_name, body.second_name, body.third_name, bj, tid)
            )
        return get_tournament_dict(conn, tid)


# ── Frontend ──────────────────────────────────────────────────────────────────
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    print("SotoPong запущен: http://localhost:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
