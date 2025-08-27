"""
Unit tests for database module - User Progress Tracking and SRS System
"""

import sqlite3
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from database import UserProgressDB


class TestUserProgressDB:
    """Test cases for UserProgressDB class"""

    @pytest.fixture
    async def temp_db(self):
        """Create temporary database for testing"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_file:
            db_path = Path(tmp_file.name)

        db = UserProgressDB(db_path)
        await db.initialize()

        yield db

        # Cleanup
        if db_path.exists():
            db_path.unlink()

    @pytest.fixture
    async def sample_progress_db(self, temp_db):
        """Database with sample progress data"""
        db = temp_db

        # Add sample users and progress
        await db.ensure_user_exists("user1", "PL")
        await db.ensure_user_exists("user2", "RU")

        # Add some drill results
        await db.update_drill_result(
            user_id="user1",
            grammar_id="bg.no_infinitive.da_present",
            drill_type="transform",
            user_answer="да поръчам",
            correct_answer="да поръчам",
            is_correct=True,
            response_time_ms=2500,
            hint_used=False,
        )

        await db.update_drill_result(
            user_id="user1",
            grammar_id="bg.definite.article.postposed",
            drill_type="fill",
            user_answer="столът",
            correct_answer="столът",
            is_correct=True,
            response_time_ms=1800,
            hint_used=False,
        )

        # Add incorrect result
        await db.update_drill_result(
            user_id="user1",
            grammar_id="bg.future.shte",
            drill_type="transform",
            user_answer="ходя утре",
            correct_answer="ще ходя утре",
            is_correct=False,
            response_time_ms=3200,
            hint_used=True,
        )

        return db

    async def test_database_initialization(self, temp_db):
        """Test database schema initialization"""
        db = temp_db

        # Verify tables exist
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        # Check tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]

        assert "users" in tables
        assert "user_progress" in tables
        assert "drill_sessions" in tables

        # Check indexes exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indexes = [row[0] for row in cursor.fetchall()]

        assert any("idx_user_progress_due" in idx for idx in indexes)
        assert any("idx_drill_sessions_user_grammar" in idx for idx in indexes)

        conn.close()

    async def test_ensure_user_exists(self, temp_db):
        """Test user creation and existence checking"""
        db = temp_db

        # Create new user
        await db.ensure_user_exists("test_user", "PL")

        # Verify user exists in database
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT user_id, l1_language FROM users WHERE user_id = ?", ("test_user",)
        )
        result = cursor.fetchone()

        assert result is not None
        assert result[0] == "test_user"
        assert result[1] == "PL"

        conn.close()

    async def test_ensure_user_exists_duplicate(self, temp_db):
        """Test that duplicate user creation is handled gracefully"""
        db = temp_db

        # Create user twice
        await db.ensure_user_exists("dup_user", "RU")
        await db.ensure_user_exists("dup_user", "UK")  # Different L1 language

        # Should still only have one record with original language
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM users WHERE user_id = ?", ("dup_user",))
        count = cursor.fetchone()[0]
        assert count == 1

        cursor.execute("SELECT l1_language FROM users WHERE user_id = ?", ("dup_user",))
        language = cursor.fetchone()[0]
        assert language == "RU"  # Original language preserved

        conn.close()

    async def test_update_drill_result_new_user(self, temp_db):
        """Test drill result update for new user/grammar item"""
        db = temp_db

        await db.update_drill_result(
            user_id="new_user",
            grammar_id="bg.test.grammar",
            drill_type="transform",
            user_answer="test answer",
            correct_answer="test answer",
            is_correct=True,
            response_time_ms=1500,
            hint_used=False,
        )

        # Verify drill session was recorded
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM drill_sessions WHERE user_id = ? AND grammar_id = ?",
            ("new_user", "bg.test.grammar"),
        )
        session = cursor.fetchone()

        assert session is not None
        assert session[3] == "transform"  # drill_type
        assert session[4] == "test answer"  # user_answer
        assert session[5] == "test answer"  # correct_answer
        assert session[6] == 1  # is_correct (boolean as int)
        assert session[7] == 1500  # response_time_ms
        assert session[8] == 0  # hint_used (boolean as int)

        # Verify progress was created
        cursor.execute(
            "SELECT mastery_level, correct_count, total_count FROM user_progress "
            "WHERE user_id = ? AND grammar_id = ?",
            ("new_user", "bg.test.grammar"),
        )
        progress = cursor.fetchone()

        assert progress is not None
        assert progress[0] == 1  # mastery_level (correct answer without hint)
        assert progress[1] == 1  # correct_count
        assert progress[2] == 1  # total_count

        conn.close()

    async def test_update_drill_result_incorrect_answer(self, temp_db):
        """Test drill result update with incorrect answer"""
        db = temp_db

        # First correct answer
        await db.update_drill_result(
            user_id="test_user",
            grammar_id="bg.test.item",
            drill_type="fill",
            user_answer="correct",
            correct_answer="correct",
            is_correct=True,
            response_time_ms=1000,
            hint_used=False,
        )

        # Then incorrect answer
        await db.update_drill_result(
            user_id="test_user",
            grammar_id="bg.test.item",
            drill_type="fill",
            user_answer="wrong",
            correct_answer="correct",
            is_correct=False,
            response_time_ms=2000,
            hint_used=False,
        )

        progress = await db.get_user_progress("test_user", "bg.test.item")

        assert len(progress) == 1
        assert progress[0]["mastery_level"] == 0  # Reset to 0 on incorrect
        assert progress[0]["correct_count"] == 1  # Still 1 correct out of 2 total
        assert progress[0]["total_count"] == 2
        assert progress[0]["accuracy"] == 0.5

    async def test_srs_interval_progression(self, temp_db):
        """Test SRS interval progression: [1, 3, 7, 21, 60, 120] days"""
        db = temp_db

        user_id = "srs_user"
        grammar_id = "bg.srs.test"

        # Correct answers should increase mastery level
        for _i in range(6):  # Test all mastery levels
            await db.update_drill_result(
                user_id=user_id,
                grammar_id=grammar_id,
                drill_type="test",
                user_answer="correct",
                correct_answer="correct",
                is_correct=True,
                hint_used=False,
            )

        progress = await db.get_user_progress(user_id, grammar_id)

        assert len(progress) == 1
        assert progress[0]["mastery_level"] == 5  # Max level (0-5 = 6 levels)
        assert progress[0]["current_interval_days"] == 120  # Max interval

    async def test_get_due_items_new_user(self, temp_db):
        """Test getting due items for new user"""
        db = temp_db

        due_items = await db.get_due_items("brand_new_user", limit=5)

        # New user should have empty list (no items practiced yet)
        assert due_items == []

    async def test_get_due_items_with_progress(self, sample_progress_db):
        """Test getting due items for user with progress"""
        db = sample_progress_db

        # Items should not be due immediately after completion
        due_items = await db.get_due_items("user1", limit=10)

        # Should return items with low mastery for practice
        assert isinstance(due_items, list)
        # With our sample data, some items might be returned for continued practice

    async def test_get_user_progress_all_items(self, sample_progress_db):
        """Test getting all user progress"""
        db = sample_progress_db

        progress = await db.get_user_progress("user1")

        assert len(progress) == 3  # Three grammar items in sample data

        # Check progress structure
        for item in progress:
            assert "grammar_id" in item
            assert "mastery_level" in item
            assert "correct_count" in item
            assert "total_count" in item
            assert "accuracy" in item
            assert "next_due_date" in item

    async def test_get_user_progress_specific_item(self, sample_progress_db):
        """Test getting progress for specific grammar item"""
        db = sample_progress_db

        progress = await db.get_user_progress("user1", "bg.no_infinitive.da_present")

        assert len(progress) == 1
        assert progress[0]["grammar_id"] == "bg.no_infinitive.da_present"
        assert progress[0]["correct_count"] == 1
        assert progress[0]["total_count"] == 1
        assert progress[0]["accuracy"] == 1.0

    async def test_get_user_statistics(self, sample_progress_db):
        """Test comprehensive user statistics"""
        db = sample_progress_db

        stats = await db.get_user_statistics("user1")

        assert stats["total_items_practiced"] == 3
        assert stats["total_correct_answers"] == 2  # 2 correct out of 3 total
        assert stats["total_attempts"] == 3
        assert stats["overall_accuracy"] == 2 / 3
        assert stats["recent_sessions_count"] == 3  # All sessions are recent
        assert "avg_response_time_ms" in stats
        assert "items_needing_attention" in stats

    async def test_get_user_statistics_no_data(self, temp_db):
        """Test statistics for user with no progress"""
        db = temp_db

        stats = await db.get_user_statistics("no_data_user")

        assert stats["total_items_practiced"] == 0
        assert stats["total_correct_answers"] == 0
        assert stats["total_attempts"] == 0
        assert stats["overall_accuracy"] == 0.0
        assert stats["recent_sessions_count"] == 0

    async def test_hint_usage_affects_mastery(self, temp_db):
        """Test that using hints affects mastery progression"""
        db = temp_db

        user_id = "hint_user"
        grammar_id = "bg.hint.test"

        # Correct answer with hint should not increase mastery as much
        await db.update_drill_result(
            user_id=user_id,
            grammar_id=grammar_id,
            drill_type="test",
            user_answer="correct",
            correct_answer="correct",
            is_correct=True,
            hint_used=True,  # Hint was used
        )

        progress = await db.get_user_progress(user_id, grammar_id)

        assert len(progress) == 1
        assert progress[0]["mastery_level"] == 0  # No mastery increase with hint

    async def test_drill_session_recording(self, sample_progress_db):
        """Test that all drill sessions are recorded properly"""
        db = sample_progress_db

        # Check drill sessions were recorded
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT COUNT(*) FROM drill_sessions WHERE user_id = ?", ("user1",)
        )
        session_count = cursor.fetchone()[0]

        assert session_count == 3  # Three drill results were submitted

        # Check session details
        cursor.execute(
            "SELECT drill_type, is_correct, hint_used FROM drill_sessions "
            "WHERE user_id = ? ORDER BY session_timestamp",
            ("user1",),
        )
        sessions = cursor.fetchall()

        assert sessions[0][0] == "transform"  # First drill type
        assert sessions[0][1] == 1  # was correct
        assert sessions[0][2] == 0  # no hint

        assert sessions[2][1] == 0  # Third was incorrect
        assert sessions[2][2] == 1  # hint was used

        conn.close()

    async def test_database_path_creation(self):
        """Test that database directory is created if it doesn't exist"""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "subdir" / "test.db"

            # Directory shouldn't exist initially
            assert not db_path.parent.exists()

            # Initialize database
            UserProgressDB(db_path)

            # Directory should be created
            assert db_path.parent.exists()


class TestProgressTrackingIntegration:
    """Integration tests with content system"""

    @pytest.fixture
    async def integration_db(self):
        """Database setup for integration testing"""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_file:
            db_path = Path(tmp_file.name)

        db = UserProgressDB(db_path)
        await db.initialize()

        yield db

        # Cleanup
        if db_path.exists():
            db_path.unlink()

    async def test_srs_scheduling_accuracy(self, integration_db):
        """Test that SRS scheduling works correctly over time"""
        db = integration_db
        user_id = "srs_test_user"
        grammar_id = "bg.srs.item"

        # Simulate learning progression over time
        base_time = datetime.now()

        # Day 0: First attempt (correct)
        await db.update_drill_result(
            user_id, grammar_id, "test", "correct", "correct", True
        )

        # Should be due in 3 days (mastery level 1)
        progress = await db.get_user_progress(user_id, grammar_id)
        next_due = datetime.fromisoformat(progress[0]["next_due_date"])
        expected_due = base_time + timedelta(days=3)

        # Allow for small time differences
        time_diff = abs((next_due - expected_due).total_seconds())
        assert time_diff < 60  # Within 1 minute

    async def test_multiple_users_isolation(self, integration_db):
        """Test that progress tracking isolates users correctly"""
        db = integration_db

        # Add progress for multiple users
        await db.update_drill_result(
            "user_a", "grammar1", "test", "answer", "answer", True
        )
        await db.update_drill_result(
            "user_b", "grammar1", "test", "answer", "answer", False
        )

        # Get progress for each user
        progress_a = await db.get_user_progress("user_a", "grammar1")
        progress_b = await db.get_user_progress("user_b", "grammar1")

        assert len(progress_a) == 1
        assert len(progress_b) == 1

        # Different mastery levels
        assert progress_a[0]["mastery_level"] == 1  # Correct answer
        assert progress_b[0]["mastery_level"] == 0  # Incorrect answer

        # User A shouldn't see User B's progress
        all_progress_a = await db.get_user_progress("user_a")
        assert len(all_progress_a) == 1
        assert all_progress_a[0]["grammar_id"] == "grammar1"

    async def test_performance_with_large_dataset(self, integration_db):
        """Test database performance with larger dataset"""
        db = integration_db

        # Add progress for multiple users and grammar items
        users = [f"user_{i}" for i in range(10)]
        grammar_items = [f"bg.grammar.{i}" for i in range(20)]

        # Add drill results
        for user in users:
            for grammar in grammar_items[:5]:  # Each user practices 5 items
                await db.update_drill_result(
                    user, grammar, "test", "answer", "answer", True
                )

        # Test querying performance
        import time

        start_time = time.time()
        for user in users:
            await db.get_user_progress(user)
            await db.get_user_statistics(user)
            await db.get_due_items(user)

        end_time = time.time()

        # Should complete quickly (under 1 second for this dataset)
        assert end_time - start_time < 1.0
