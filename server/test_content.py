"""
Unit tests for the content module.
"""

import json
from unittest.mock import mock_open, patch

import pytest
from content import (
    get_grammar_item,
    get_next_lesson,
    get_scenario,
    load_grammar_pack,
    load_scenarios,
)


class TestLoadGrammarPack:
    """Test grammar pack loading functionality."""

    @patch("content.Path.exists")
    def test_load_grammar_pack_success(self, mock_exists):
        """Test successful grammar pack loading."""
        mock_grammar_data = {
            "bg.no_infinitive.da_present": {
                "id": "bg.no_infinitive.da_present",
                "explanation": "Bulgarian uses да + present tense instead of infinitive",
                "examples": ["Искам да ям (I want to eat)"],
            }
        }

        mock_file_content = json.dumps(mock_grammar_data)
        mock_exists.return_value = True

        with patch("builtins.open", mock_open(read_data=mock_file_content)):
            result = load_grammar_pack()

        assert "bg.no_infinitive.da_present" in result
        assert isinstance(result, dict)

    @patch("content.Path.exists")
    def test_load_grammar_pack_file_not_found(self, mock_exists):
        """Test grammar pack loading when file doesn't exist."""
        mock_exists.return_value = False
        result = load_grammar_pack()

        # Should return sample data when file not found
        assert isinstance(result, dict)
        assert len(result) > 0  # Sample data should not be empty

    @patch("content.Path.exists")
    def test_load_grammar_pack_invalid_json(self, mock_exists):
        """Test grammar pack loading with invalid JSON."""
        mock_exists.return_value = True
        with patch("builtins.open", mock_open(read_data="invalid json")):
            result = load_grammar_pack()

        # Should return sample data when JSON is invalid
        assert isinstance(result, dict)
        assert len(result) > 0


class TestLoadScenarios:
    """Test scenario loading functionality."""

    @patch("content.Path.exists")
    def test_load_scenarios_success(self, mock_exists):
        """Test successful scenario loading."""
        mock_scenarios_data = {
            "restaurant_order": {
                "id": "restaurant_order",
                "title": "Ordering Food at a Restaurant",
                "description": "Practice ordering food in Bulgarian",
                "level": "A2",
                "grammar_focus": ["bg.no_infinitive.da_present"],
            }
        }

        mock_file_content = json.dumps(mock_scenarios_data)
        mock_exists.return_value = True

        with patch("builtins.open", mock_open(read_data=mock_file_content)):
            result = load_scenarios()

        assert "restaurant_order" in result
        assert isinstance(result, dict)

    @patch("content.Path.exists")
    def test_load_scenarios_file_not_found(self, mock_exists):
        """Test scenario loading when file doesn't exist."""
        mock_exists.return_value = False
        result = load_scenarios()

        # Should return sample data when file not found
        assert isinstance(result, dict)
        assert len(result) > 0

    @patch("content.Path.exists")
    def test_load_scenarios_invalid_json(self, mock_exists):
        """Test scenario loading with invalid JSON."""
        mock_exists.return_value = True
        with patch("builtins.open", mock_open(read_data="invalid json")):
            result = load_scenarios()

        # Should return sample data when JSON is invalid
        assert isinstance(result, dict)
        assert len(result) > 0


class TestGetGrammarItem:
    """Test grammar item retrieval."""

    def test_get_grammar_item_exists(self):
        """Test retrieving existing grammar item."""
        mock_grammar_index = {
            "bg.no_infinitive.da_present": {
                "id": "bg.no_infinitive.da_present",
                "explanation": "Test explanation",
                "examples": ["Test example"],
            }
        }

        with patch("content.load_grammar_pack", return_value=mock_grammar_index):
            result = get_grammar_item("bg.no_infinitive.da_present")

        assert result is not None
        assert result["id"] == "bg.no_infinitive.da_present"
        assert result["explanation"] == "Test explanation"

    def test_get_grammar_item_not_exists(self):
        """Test retrieving non-existent grammar item."""
        with patch("content.load_grammar_pack", return_value={}):
            result = get_grammar_item("nonexistent.item")

        assert result is None

    def test_get_grammar_item_empty_id(self):
        """Test retrieving grammar item with empty ID."""
        result = get_grammar_item("")
        assert result is None

        result = get_grammar_item(None)
        assert result is None


class TestGetNextLesson:
    """Test lesson sequencing functionality."""

    def test_get_next_lesson_returns_drills(self):
        """Test getting next lesson returns drill list."""
        result = get_next_lesson("test_user")

        assert isinstance(result, list)
        # Should return drills for practice

    def test_get_next_lesson_with_different_user(self):
        """Test getting next lesson for different user."""
        result1 = get_next_lesson("user1")
        result2 = get_next_lesson("user2")

        # Both should return drill lists
        assert isinstance(result1, list)
        assert isinstance(result2, list)

    def test_get_next_lesson_drill_structure(self):
        """Test that returned drills have proper structure."""
        result = get_next_lesson("test_user")

        for drill in result:
            assert isinstance(drill, dict)
            # Drills should have certain fields based on implementation
            assert "grammar_id" in drill or "type" in drill


class TestGetScenario:
    """Test scenario retrieval functionality."""

    def test_get_scenario_exists(self):
        """Test retrieving existing scenario."""
        mock_scenarios = {
            "test_scenario": {
                "id": "test_scenario",
                "title": "Test Scenario",
                "description": "Test description",
            }
        }

        with patch("content.load_scenarios", return_value=mock_scenarios):
            result = get_scenario("test_scenario")

        assert result is not None
        assert result["id"] == "test_scenario"
        assert result["title"] == "Test Scenario"

    def test_get_scenario_not_exists(self):
        """Test retrieving non-existent scenario."""
        with patch("content.load_scenarios", return_value={}):
            result = get_scenario("nonexistent_scenario")

        assert result is None

    def test_get_scenario_empty_id(self):
        """Test retrieving scenario with empty ID."""
        with patch("content.load_scenarios", return_value={}):
            result = get_scenario("")
            assert result is None

            result = get_scenario(None)
            assert result is None


class TestIntegration:
    """Integration tests for content module."""

    def test_module_functions_exist(self):
        """Test that expected functions exist."""
        from content import (
            get_grammar_item,
            get_next_lesson,
            get_scenario,
            load_grammar_pack,
            load_scenarios,
        )

        # These should all be callable
        assert callable(load_grammar_pack)
        assert callable(load_scenarios)
        assert callable(get_grammar_item)
        assert callable(get_next_lesson)
        assert callable(get_scenario)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
