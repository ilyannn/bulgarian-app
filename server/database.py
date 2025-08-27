"""
Database module for user progress tracking with SQLite and SRS (Spaced Repetition System)
"""

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import aiosqlite
from opentelemetry import trace

# OpenTelemetry instrumentation for SQLite (optional)
try:
    from opentelemetry.instrumentation.aiosqlite import AsyncSQLiteInstrumentor

    AsyncSQLiteInstrumentor().instrument()
except ImportError:
    # SQLite instrumentation not available, continue without it
    pass

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

# Default database path
DEFAULT_DB_PATH = Path("data") / "user_progress.db"


class UserProgressDB:
    """SQLite database for user progress tracking and SRS scheduling"""

    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info(f"Initializing user progress database at {self.db_path}")

    async def initialize(self) -> None:
        """Initialize database schema"""
        with tracer.start_as_current_span("database_initialize"):
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        user_id TEXT PRIMARY KEY,
                        l1_language TEXT NOT NULL DEFAULT 'PL',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )

                await db.execute(
                    """
                    CREATE TABLE IF NOT EXISTS user_progress (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        grammar_id TEXT NOT NULL,
                        mastery_level INTEGER DEFAULT 0,
                        correct_count INTEGER DEFAULT 0,
                        total_count INTEGER DEFAULT 0,
                        current_interval_days INTEGER DEFAULT 1,
                        next_due_date TIMESTAMP,
                        last_practiced_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (user_id),
                        UNIQUE (user_id, grammar_id)
                    )
                    """
                )

                await db.execute(
                    """
                    CREATE TABLE IF NOT EXISTS drill_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        grammar_id TEXT NOT NULL,
                        drill_type TEXT NOT NULL,
                        user_answer TEXT,
                        correct_answer TEXT NOT NULL,
                        is_correct BOOLEAN NOT NULL,
                        response_time_ms INTEGER,
                        hint_used BOOLEAN DEFAULT FALSE,
                        session_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (user_id)
                    )
                    """
                )

                await db.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_user_progress_due
                    ON user_progress (user_id, next_due_date)
                    """
                )

                await db.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_drill_sessions_user_grammar
                    ON drill_sessions (user_id, grammar_id, session_timestamp)
                    """
                )

                await db.commit()
                logger.info("Database schema initialized successfully")

    async def ensure_user_exists(self, user_id: str, l1_language: str = "PL") -> None:
        """Ensure user exists in database"""
        with tracer.start_as_current_span("ensure_user_exists") as span:
            span.set_attribute("user_id", user_id)
            span.set_attribute("l1_language", l1_language)

            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    """
                    INSERT OR IGNORE INTO users (user_id, l1_language)
                    VALUES (?, ?)
                    """,
                    (user_id, l1_language),
                )
                await db.commit()

    async def get_user_progress(
        self, user_id: str, grammar_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Get user progress for all grammar items or specific grammar item"""
        with tracer.start_as_current_span("get_user_progress") as span:
            span.set_attribute("user_id", user_id)
            if grammar_id:
                span.set_attribute("grammar_id", grammar_id)

            async with aiosqlite.connect(self.db_path) as db:
                if grammar_id:
                    cursor = await db.execute(
                        """
                        SELECT grammar_id, mastery_level, correct_count, total_count,
                               current_interval_days, next_due_date, last_practiced_at,
                               created_at, updated_at
                        FROM user_progress
                        WHERE user_id = ? AND grammar_id = ?
                        """,
                        (user_id, grammar_id),
                    )
                else:
                    cursor = await db.execute(
                        """
                        SELECT grammar_id, mastery_level, correct_count, total_count,
                               current_interval_days, next_due_date, last_practiced_at,
                               created_at, updated_at
                        FROM user_progress
                        WHERE user_id = ?
                        ORDER BY updated_at DESC
                        """,
                        (user_id,),
                    )

                rows = await cursor.fetchall()
                return [
                    {
                        "grammar_id": row[0],
                        "mastery_level": row[1],
                        "correct_count": row[2],
                        "total_count": row[3],
                        "current_interval_days": row[4],
                        "next_due_date": row[5],
                        "last_practiced_at": row[6],
                        "created_at": row[7],
                        "updated_at": row[8],
                        "accuracy": (
                            row[2] / row[3] if row[3] > 0 else 0.0
                        ),  # correct/total
                    }
                    for row in rows
                ]

    async def get_due_items(self, user_id: str, limit: int = 10) -> list[str]:
        """Get grammar IDs that are due for practice"""
        with tracer.start_as_current_span("get_due_items") as span:
            span.set_attribute("user_id", user_id)
            span.set_attribute("limit", limit)

            await self.ensure_user_exists(user_id)

            async with aiosqlite.connect(self.db_path) as db:
                now = datetime.now().isoformat()
                cursor = await db.execute(
                    """
                    SELECT grammar_id, mastery_level
                    FROM user_progress
                    WHERE user_id = ? AND (
                        next_due_date IS NULL OR
                        next_due_date <= ?
                    )
                    ORDER BY
                        mastery_level ASC,  -- prioritize less mastered items
                        last_practiced_at ASC NULLS FIRST,
                        created_at ASC
                    LIMIT ?
                    """,
                    (user_id, now, limit),
                )

                rows = await cursor.fetchall()
                due_items = [row[0] for row in rows]

                # If no items are due, return some low-mastery items for practice
                if not due_items:
                    cursor = await db.execute(
                        """
                        SELECT grammar_id
                        FROM user_progress
                        WHERE user_id = ?
                        ORDER BY mastery_level ASC, total_count ASC
                        LIMIT ?
                        """,
                        (user_id, min(3, limit)),
                    )
                    rows = await cursor.fetchall()
                    due_items = [row[0] for row in rows]

                span.set_attribute("due_items_count", len(due_items))
                logger.debug(f"Found {len(due_items)} due items for user {user_id}")
                return due_items

    async def update_drill_result(
        self,
        user_id: str,
        grammar_id: str,
        drill_type: str,
        user_answer: str,
        correct_answer: str,
        is_correct: bool,
        response_time_ms: int | None = None,
        hint_used: bool = False,
    ) -> None:
        """Update user progress based on drill result"""
        with tracer.start_as_current_span("update_drill_result") as span:
            span.set_attribute("user_id", user_id)
            span.set_attribute("grammar_id", grammar_id)
            span.set_attribute("is_correct", is_correct)
            span.set_attribute("hint_used", hint_used)

            await self.ensure_user_exists(user_id)

            # SRS intervals in days: [1, 3, 7, 21, 60, 120]
            srs_intervals = [1, 3, 7, 21, 60, 120]

            async with aiosqlite.connect(self.db_path) as db:
                # First, record the drill session
                await db.execute(
                    """
                    INSERT INTO drill_sessions
                    (user_id, grammar_id, drill_type, user_answer, correct_answer,
                     is_correct, response_time_ms, hint_used)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        grammar_id,
                        drill_type,
                        user_answer,
                        correct_answer,
                        is_correct,
                        response_time_ms,
                        hint_used,
                    ),
                )

                # Get current progress
                cursor = await db.execute(
                    """
                    SELECT mastery_level, correct_count, total_count, current_interval_days
                    FROM user_progress
                    WHERE user_id = ? AND grammar_id = ?
                    """,
                    (user_id, grammar_id),
                )
                row = await cursor.fetchone()

                now = datetime.now().isoformat()

                if row:
                    # Update existing progress
                    mastery_level, correct_count, total_count, current_interval_days = (
                        row
                    )
                    new_correct_count = correct_count + (1 if is_correct else 0)
                    new_total_count = total_count + 1

                    # Update mastery level based on performance
                    if is_correct and not hint_used:
                        new_mastery_level = min(
                            len(srs_intervals) - 1, mastery_level + 1
                        )
                    elif not is_correct:
                        new_mastery_level = max(0, mastery_level - 1)
                    else:
                        new_mastery_level = mastery_level  # No change if hint was used

                    # Calculate next interval
                    new_interval_days = srs_intervals[new_mastery_level]
                    next_due = datetime.now() + timedelta(days=new_interval_days)

                    await db.execute(
                        """
                        UPDATE user_progress
                        SET mastery_level = ?, correct_count = ?, total_count = ?,
                            current_interval_days = ?, next_due_date = ?,
                            last_practiced_at = ?, updated_at = ?
                        WHERE user_id = ? AND grammar_id = ?
                        """,
                        (
                            new_mastery_level,
                            new_correct_count,
                            new_total_count,
                            new_interval_days,
                            next_due.isoformat(),
                            now,
                            now,
                            user_id,
                            grammar_id,
                        ),
                    )

                    span.set_attribute("mastery_level", new_mastery_level)
                    span.set_attribute("next_due_days", new_interval_days)

                else:
                    # Create new progress entry
                    initial_mastery = 1 if is_correct and not hint_used else 0
                    initial_interval = srs_intervals[initial_mastery]
                    next_due = datetime.now() + timedelta(days=initial_interval)

                    await db.execute(
                        """
                        INSERT INTO user_progress
                        (user_id, grammar_id, mastery_level, correct_count, total_count,
                         current_interval_days, next_due_date, last_practiced_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            user_id,
                            grammar_id,
                            initial_mastery,
                            1 if is_correct else 0,
                            1,
                            initial_interval,
                            next_due.isoformat(),
                            now,
                            now,
                        ),
                    )

                    span.set_attribute("mastery_level", initial_mastery)
                    span.set_attribute("next_due_days", initial_interval)

                await db.commit()
                logger.debug(
                    f"Updated progress for user {user_id}, grammar {grammar_id}: "
                    f"correct={is_correct}, hint_used={hint_used}"
                )

    async def get_user_statistics(self, user_id: str) -> dict[str, Any]:
        """Get comprehensive user statistics"""
        with tracer.start_as_current_span("get_user_statistics") as span:
            span.set_attribute("user_id", user_id)

            async with aiosqlite.connect(self.db_path) as db:
                # Overall progress stats
                cursor = await db.execute(
                    """
                    SELECT
                        COUNT(*) as total_items,
                        SUM(correct_count) as total_correct,
                        SUM(total_count) as total_attempts,
                        AVG(mastery_level) as avg_mastery,
                        COUNT(CASE WHEN mastery_level >= 4 THEN 1 END) as mastered_items
                    FROM user_progress
                    WHERE user_id = ?
                    """,
                    (user_id,),
                )
                overall_stats = await cursor.fetchone()

                # Recent activity (last 7 days)
                week_ago = (datetime.now() - timedelta(days=7)).isoformat()
                cursor = await db.execute(
                    """
                    SELECT
                        COUNT(*) as sessions_count,
                        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_sessions,
                        AVG(response_time_ms) as avg_response_time
                    FROM drill_sessions
                    WHERE user_id = ? AND session_timestamp >= ?
                    """,
                    (user_id, week_ago),
                )
                recent_activity = await cursor.fetchone()

                # Items needing attention (low mastery or overdue)
                now = datetime.now().isoformat()
                cursor = await db.execute(
                    """
                    SELECT COUNT(*)
                    FROM user_progress
                    WHERE user_id = ? AND (
                        mastery_level <= 1 OR
                        (next_due_date IS NOT NULL AND next_due_date <= ?)
                    )
                    """,
                    (user_id, now),
                )
                items_needing_attention = (await cursor.fetchone())[0]

                return {
                    "total_items_practiced": overall_stats[0]
                    if overall_stats[0]
                    else 0,
                    "total_correct_answers": (
                        overall_stats[1] if overall_stats[1] else 0
                    ),
                    "total_attempts": overall_stats[2] if overall_stats[2] else 0,
                    "overall_accuracy": (
                        (overall_stats[1] / overall_stats[2])
                        if overall_stats[2]
                        else 0.0
                    ),
                    "average_mastery_level": (
                        round(overall_stats[3], 1) if overall_stats[3] else 0.0
                    ),
                    "mastered_items": overall_stats[4] if overall_stats[4] else 0,
                    "recent_sessions_count": (
                        recent_activity[0] if recent_activity[0] else 0
                    ),
                    "recent_accuracy": (
                        (recent_activity[1] / recent_activity[0])
                        if recent_activity[0]
                        else 0.0
                    ),
                    "avg_response_time_ms": (
                        round(recent_activity[2]) if recent_activity[2] else 0
                    ),
                    "items_needing_attention": items_needing_attention,
                }

    async def close(self) -> None:
        """Close database connection (placeholder for cleanup if needed)"""
        logger.debug("Database connection cleanup completed")


# Global database instance
user_progress_db = UserProgressDB()
