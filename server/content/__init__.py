"""
Content loading and management system for Bulgarian grammar and scenarios
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

# Content directory path
CONTENT_DIR = Path(__file__).parent


def load_grammar_pack() -> dict[str, Any]:
    """
    Load Bulgarian grammar pack from JSON file

    Returns:
        Dictionary mapping grammar IDs to grammar items
    """
    try:
        grammar_file = CONTENT_DIR / "bg_grammar_pack.json"

        if not grammar_file.exists():
            print(f"Warning: Grammar pack not found at {grammar_file}")
            return _create_sample_grammar_pack()

        with open(grammar_file, encoding="utf-8") as f:
            grammar_data = json.load(f)

        # Convert list to dictionary indexed by ID
        if isinstance(grammar_data, list):
            return {item["id"]: item for item in grammar_data}
        elif isinstance(grammar_data, dict):
            return grammar_data
        else:
            raise ValueError("Invalid grammar pack format")

    except Exception as e:
        print(f"Error loading grammar pack: {e}")
        return _create_sample_grammar_pack()


def load_scenarios() -> dict[str, Any]:
    """
    Load scenarios with grammar bindings from JSON file

    Returns:
        Dictionary mapping scenario IDs to scenario data
    """
    try:
        scenarios_file = CONTENT_DIR / "bg_scenarios_with_grammar.json"

        if not scenarios_file.exists():
            print(f"Warning: Scenarios file not found at {scenarios_file}")
            return _create_sample_scenarios()

        with open(scenarios_file, encoding="utf-8") as f:
            scenarios_data = json.load(f)

        # Convert list to dictionary indexed by ID
        if isinstance(scenarios_data, list):
            return {item["id"]: item for item in scenarios_data}
        elif isinstance(scenarios_data, dict):
            return scenarios_data
        else:
            raise ValueError("Invalid scenarios format")

    except Exception as e:
        print(f"Error loading scenarios: {e}")
        return _create_sample_scenarios()


def get_grammar_item(grammar_id: str) -> dict[str, Any] | None:
    """
    Get a specific grammar item by ID

    Args:
        grammar_id: Grammar item ID

    Returns:
        Grammar item dictionary or None if not found
    """
    grammar_pack = load_grammar_pack()
    return grammar_pack.get(grammar_id)


def get_scenario(scenario_id: str) -> dict[str, Any] | None:
    """
    Get a specific scenario by ID

    Args:
        scenario_id: Scenario ID

    Returns:
        Scenario dictionary or None if not found
    """
    scenarios = load_scenarios()
    return scenarios.get(scenario_id)


def get_next_lesson(user_id: str) -> list[dict[str, Any]]:
    """
    Get next lesson drills based on SRS (Spaced Repetition System)

    Args:
        user_id: User identifier

    Returns:
        List of drill items due for practice
    """
    # For MVP, return sample drills
    # In production, this would query user progress from database

    grammar_pack = load_grammar_pack()
    due_drills = []

    # Sample implementation - in practice, this would check user progress
    sample_due_items = ["bg.no_infinitive.da_present", "bg.definite.article.postposed"]

    for grammar_id in sample_due_items:
        if grammar_id in grammar_pack:
            item = grammar_pack[grammar_id]
            if "drills" in item and item["drills"]:
                # Add first drill from each due grammar item
                drill = item["drills"][0].copy()
                drill["grammar_id"] = grammar_id
                drill["due_date"] = datetime.now().isoformat()
                due_drills.append(drill)

    return due_drills[:3]  # Return max 3 drills at a time


def _create_sample_grammar_pack() -> dict[str, Any]:
    """Create sample grammar pack for development"""
    return {
        "bg.no_infinitive.da_present": {
            "id": "bg.no_infinitive.da_present",
            "title_bg": "Няма инфинитив: 'да' + сегашно",
            "level": ["A2", "B1"],
            "micro_explanation_bg": "В български няма инфинитив. Използваме 'да' + сегашно: 'Искам да поръчам'.",
            "contrast_notes": {
                "PL": "W polskim używamy bezokolicznika, w bułgarskim 'да' + czasownik w czasie teraźniejszym",
                "RU": "В русском используется инфинитив, в болгарском 'да' + настоящее время",
                "SR": "U srpskom koristimo infinitiv, u bugarskom 'да' + prezent",
            },
            "examples": [
                {"wrong": "Искам поръчвам кафе.", "right": "Искам да поръчам кафе."},
                {
                    "wrong": "Мога говоря български.",
                    "right": "Мога да говоря български.",
                },
            ],
            "drills": [
                {
                    "type": "transform",
                    "prompt_bg": "Искам ___ (поръчвам) кафе.",
                    "answer_bg": "да поръчам",
                    "explanation_bg": "Използвайте 'да' + сегашно време",
                },
                {
                    "type": "fill",
                    "prompt_bg": "Трябва ___ работя утре.",
                    "answer_bg": "да",
                    "explanation_bg": "'да' + сегашно време за необходимост",
                },
            ],
            "srs": {"interval_days": [1, 3, 7, 21]},
        },
        "bg.definite.article.postposed": {
            "id": "bg.definite.article.postposed",
            "title_bg": "Определителен член: накрайник",
            "level": ["A1", "A2"],
            "micro_explanation_bg": "Определителният член в български е накрайник: -ът/-та/-то/-те.",
            "contrast_notes": {
                "PL": "W polskim nie ma rodzajników, w bułgarskim dodajemy na końcu słowa",
                "RU": "В русском нет артиклей, в болгарском добавляем в конце слова",
                "SR": "U srpskom nema članova, u bugarskom dodajemo na kraju reči",
            },
            "examples": [
                {
                    "wrong": "стол",
                    "right": "столът",
                    "context": "когато говорим за конкретен стол",
                },
                {
                    "wrong": "the книга",
                    "right": "книгата",
                    "context": "определена книга",
                },
            ],
            "drills": [
                {
                    "type": "transform",
                    "prompt_bg": "Къде е ___ (стол)?",
                    "answer_bg": "столът",
                    "explanation_bg": "Мъжки род, единствено число: -ът",
                }
            ],
            "srs": {"interval_days": [1, 3, 7, 21]},
        },
        "bg.future.shte": {
            "id": "bg.future.shte",
            "title_bg": "Бъдеще време с 'ще'",
            "level": ["A2"],
            "micro_explanation_bg": "За бъдеще време използваме 'ще' + сегашно време.",
            "contrast_notes": {
                "PL": "W polskim używamy końcówek przyszłych, w bułgarskim 'ще' + prezent",
                "RU": "В русском будущее время с 'буду', в болгарском с 'ще'",
                "SR": "U srpskom buduće vreme sa 'ću', u bugarskom sa 'ще'",
            },
            "examples": [
                {"wrong": "Утре ходя на работа.", "right": "Утре ще ходя на работа."},
                {
                    "wrong": "Следващата седмица пътувам.",
                    "right": "Следващата седмица ще пътувам.",
                },
            ],
            "drills": [
                {
                    "type": "transform",
                    "prompt_bg": "Утре ___ (ходя) на пазар.",
                    "answer_bg": "ще ходя",
                    "explanation_bg": "'ще' + сегашно време за бъдещи действия",
                }
            ],
            "srs": {"interval_days": [1, 3, 7, 21]},
        },
    }


def _create_sample_scenarios() -> dict[str, Any]:
    """Create sample scenarios for development"""
    return {
        "a2_cafe_ordering": {
            "id": "a2_cafe_ordering",
            "title": "В кафене: поръчка",
            "title_bg": "В кафене: поръчка",
            "level": "A2",
            "description": "Ordering food and drinks at a café",
            "description_bg": "Поръчване на храна и напитки в кафене",
            "grammar_binding": {
                "primary": [
                    "bg.no_infinitive.da_present",
                    "bg.definite.article.postposed",
                ],
                "secondary": ["bg.future.shte"],
                "binding_method": "auto-heuristic-v1",
            },
            "key_phrases": [
                "Искам да поръчам кафето.",
                "Можете ли да ми дадете менюто?",
                "Колко струва салатата?",
            ],
        },
        "a2_directions": {
            "id": "a2_directions",
            "title": "Посоки в града",
            "title_bg": "Посоки в града",
            "level": "A2",
            "description": "Asking for and giving directions in the city",
            "description_bg": "Питане и даване на посоки в града",
            "grammar_binding": {
                "primary": ["bg.definite.article.postposed"],
                "secondary": ["bg.no_infinitive.da_present"],
                "binding_method": "auto-heuristic-v1",
            },
            "key_phrases": [
                "Къде е библиотеката?",
                "Как да стигна до центъра?",
                "Благодаря за помощта!",
            ],
        },
    }


# Progress tracking (simplified for MVP)
class ProgressTracker:
    """Simple progress tracking for SRS"""

    def __init__(self):
        self.user_progress = {}  # In production, this would be a database

    def update_drill_result(self, user_id: str, grammar_id: str, correct: bool):
        """Update user progress for a drill"""
        if user_id not in self.user_progress:
            self.user_progress[user_id] = {}

        if grammar_id not in self.user_progress[user_id]:
            self.user_progress[user_id][grammar_id] = {
                "correct_count": 0,
                "total_count": 0,
                "last_seen": None,
                "interval_index": 0,
            }

        progress = self.user_progress[user_id][grammar_id]
        progress["total_count"] += 1
        progress["last_seen"] = datetime.now()

        if correct:
            progress["correct_count"] += 1
            progress["interval_index"] = min(progress["interval_index"] + 1, 3)
        else:
            progress["interval_index"] = 0  # Reset on incorrect answer

    def get_due_items(self, user_id: str) -> list[str]:
        """Get grammar IDs that are due for review"""
        if user_id not in self.user_progress:
            return ["bg.no_infinitive.da_present"]  # Default for new users

        due_items = []
        grammar_pack = load_grammar_pack()

        for grammar_id, progress in self.user_progress[user_id].items():
            if grammar_id in grammar_pack:
                item = grammar_pack[grammar_id]
                intervals = item.get("srs", {}).get("interval_days", [1, 3, 7, 21])

                if progress["last_seen"]:
                    interval = intervals[
                        min(progress["interval_index"], len(intervals) - 1)
                    ]
                    next_due = progress["last_seen"] + timedelta(days=interval)

                    if datetime.now() >= next_due:
                        due_items.append(grammar_id)
                else:
                    due_items.append(grammar_id)  # Never seen before

        return due_items


# Global progress tracker instance
progress_tracker = ProgressTracker()


def update_progress(user_id: str, grammar_id: str, correct: bool):
    """Update user progress (convenience function)"""
    progress_tracker.update_drill_result(user_id, grammar_id, correct)
