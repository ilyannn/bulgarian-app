"""
Unit tests for the content module.
"""

import json
from unittest.mock import mock_open, patch

import pytest

from content import (
    get_grammar_item,
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

    @patch("content.Path.exists")
    def test_load_grammar_pack_new_format_with_metadata(self, mock_exists):
        """Test grammar pack loading with new JSON format (items array)."""
        mock_grammar_data = {
            "schema_version": "1.0",
            "language": "Bulgarian",
            "items": [
                {
                    "id": "bg.no_infinitive.da_present",
                    "title_bg": "Няма инфинитив: 'да' + сегашно",
                    "micro_explanation_bg": "В български няма инфинитив.",
                    "drills": [{"type": "transform", "answer_bg": "да поръчам"}],
                }
            ],
        }

        mock_file_content = json.dumps(mock_grammar_data)
        mock_exists.return_value = True

        with patch("builtins.open", mock_open(read_data=mock_file_content)):
            result = load_grammar_pack()

        assert "bg.no_infinitive.da_present" in result
        assert (
            result["bg.no_infinitive.da_present"]["title_bg"]
            == "Няма инфинитив: 'да' + сегашно"
        )
        assert len(result["bg.no_infinitive.da_present"]["drills"]) == 1


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

    @patch("content.Path.exists")
    def test_load_scenarios_new_format_with_metadata(self, mock_exists):
        """Test scenario loading with new JSON format (scenarios array)."""
        mock_scenarios_data = {
            "schema_version": "1.1",
            "language": "Bulgarian",
            "grammar_pack_ref": "bg_grammar_pack.json",
            "scenarios": [
                {
                    "id": "a2_cafe_ordering",
                    "title": "В кафене: поръчка",
                    "level": "A2",
                    "goal": "Order coffee and ask for bill",
                    "target_forms": ["Искам да поръчам", "Може ли сметката"],
                }
            ],
        }

        mock_file_content = json.dumps(mock_scenarios_data)
        mock_exists.return_value = True

        with patch("builtins.open", mock_open(read_data=mock_file_content)):
            result = load_scenarios()

        assert "a2_cafe_ordering" in result
        assert result["a2_cafe_ordering"]["title"] == "В кафене: поръчка"
        assert result["a2_cafe_ordering"]["level"] == "A2"
        assert len(result["a2_cafe_ordering"]["target_forms"]) == 2


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

        # Test with invalid/missing grammar_id
        result = get_grammar_item("nonexistent_id")
        assert result is None


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

            # Test with invalid scenario_id
            result = get_scenario("nonexistent_scenario")
            assert result is None


class TestIntegration:
    """Integration tests for content module."""

    def test_module_functions_exist(self):
        """Test that expected functions exist."""
        from content import (
            get_grammar_item,
            get_scenario,
            load_grammar_pack,
            load_scenarios,
        )

        # These should all be callable
        assert callable(load_grammar_pack)
        assert callable(load_scenarios)
        assert callable(get_grammar_item)
        assert callable(get_scenario)

    def test_real_content_files_loading(self):
        """Test loading actual content files if they exist."""
        # This test will use real files if present, fallback to sample data if not
        grammar_pack = load_grammar_pack()
        scenarios = load_scenarios()

        # Should load successfully regardless of file presence
        assert isinstance(grammar_pack, dict)
        assert isinstance(scenarios, dict)
        assert len(grammar_pack) > 0
        assert len(scenarios) > 0

        # Check that loaded items have expected structure
        for grammar_id, grammar_item in grammar_pack.items():
            assert "id" in grammar_item
            assert grammar_item["id"] == grammar_id

        for scenario_id, scenario in scenarios.items():
            assert "id" in scenario
            assert scenario["id"] == scenario_id

    def test_content_cross_references(self):
        """Test that grammar items can be retrieved from loaded content."""
        grammar_pack = load_grammar_pack()

        # Get first available grammar item ID
        if grammar_pack:
            first_id = list(grammar_pack.keys())[0]
            retrieved_item = get_grammar_item(first_id)

            assert retrieved_item is not None
            assert retrieved_item["id"] == first_id
            assert retrieved_item == grammar_pack[first_id]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
