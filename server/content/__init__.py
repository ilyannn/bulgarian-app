"""
Content loading and management system for Bulgarian grammar and scenarios
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from database import user_progress_db

logger = logging.getLogger(__name__)

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

        # Handle different JSON formats
        if isinstance(grammar_data, dict) and "items" in grammar_data:
            # New format with metadata and items array
            return {item["id"]: item for item in grammar_data["items"]}
        elif isinstance(grammar_data, list):
            # Legacy format - items as array
            return {item["id"]: item for item in grammar_data}
        elif isinstance(grammar_data, dict):
            # Legacy format - items as dictionary
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

        # Handle different JSON formats
        if isinstance(scenarios_data, dict) and "scenarios" in scenarios_data:
            # New format with metadata and scenarios array
            return {item["id"]: item for item in scenarios_data["scenarios"]}
        elif isinstance(scenarios_data, list):
            # Legacy format - scenarios as array
            return {item["id"]: item for item in scenarios_data}
        elif isinstance(scenarios_data, dict):
            # Legacy format - scenarios as dictionary
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


async def get_next_lesson(user_id: str, limit: int = 3) -> list[dict[str, Any]]:
    """
    Get next lesson drills based on SRS (Spaced Repetition System)

    Args:
        user_id: User identifier
        limit: Maximum number of drills to return

    Returns:
        List of drill items due for practice
    """
    grammar_pack = load_grammar_pack()
    due_drills = []

    try:
        # Get due grammar items from database
        due_grammar_ids = await user_progress_db.get_due_items(user_id, limit * 2)

        # If no items in database, start with foundational grammar items
        if not due_grammar_ids:
            due_grammar_ids = [
                "bg.no_infinitive.da_present",
                "bg.definite.article.postposed",
                "bg.future.shte",
            ][:limit]
            logger.info(f"New user {user_id}, providing foundational grammar items")

        for grammar_id in due_grammar_ids[:limit]:
            if grammar_id in grammar_pack:
                item = grammar_pack[grammar_id]
                if "drills" in item and item["drills"]:
                    # Add first drill from each due grammar item
                    drill = item["drills"][0].copy()
                    drill["grammar_id"] = grammar_id
                    drill["due_date"] = datetime.now().isoformat()
                    drill["title_bg"] = item.get("title_bg", "")
                    drill["micro_explanation_bg"] = item.get("micro_explanation_bg", "")
                    due_drills.append(drill)

        logger.debug(f"Generated {len(due_drills)} drills for user {user_id}")
        return due_drills

    except Exception as e:
        logger.error(f"Error getting next lesson for user {user_id}: {e}")
        # Fallback to sample drills
        sample_due_items = [
            "bg.no_infinitive.da_present",
            "bg.definite.article.postposed",
        ]

        for grammar_id in sample_due_items[:limit]:
            if grammar_id in grammar_pack:
                item = grammar_pack[grammar_id]
                if "drills" in item and item["drills"]:
                    drill = item["drills"][0].copy()
                    drill["grammar_id"] = grammar_id
                    drill["due_date"] = datetime.now().isoformat()
                    due_drills.append(drill)

        return due_drills


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


async def update_drill_progress(
    user_id: str,
    grammar_id: str,
    drill_type: str,
    user_answer: str,
    correct_answer: str,
    is_correct: bool,
    response_time_ms: int | None = None,
    hint_used: bool = False,
) -> None:
    """
    Update user progress based on drill result

    Args:
        user_id: User identifier
        grammar_id: Grammar item ID
        drill_type: Type of drill (transform, fill, reorder)
        user_answer: User's answer
        correct_answer: Expected correct answer
        is_correct: Whether the answer was correct
        response_time_ms: Time taken to answer in milliseconds
        hint_used: Whether user used a hint
    """
    try:
        await user_progress_db.update_drill_result(
            user_id=user_id,
            grammar_id=grammar_id,
            drill_type=drill_type,
            user_answer=user_answer,
            correct_answer=correct_answer,
            is_correct=is_correct,
            response_time_ms=response_time_ms,
            hint_used=hint_used,
        )
        logger.debug(f"Updated drill progress for user {user_id}, grammar {grammar_id}")
    except Exception as e:
        logger.error(f"Failed to update drill progress: {e}")


async def get_user_progress(
    user_id: str, grammar_id: str | None = None
) -> list[dict[str, Any]]:
    """
    Get user progress data

    Args:
        user_id: User identifier
        grammar_id: Optional specific grammar item ID

    Returns:
        List of progress records
    """
    try:
        return await user_progress_db.get_user_progress(user_id, grammar_id)
    except Exception as e:
        logger.error(f"Failed to get user progress: {e}")
        return []


async def get_user_statistics(user_id: str) -> dict[str, Any]:
    """
    Get comprehensive user statistics

    Args:
        user_id: User identifier

    Returns:
        Dictionary with user statistics
    """
    try:
        return await user_progress_db.get_user_statistics(user_id)
    except Exception as e:
        logger.error(f"Failed to get user statistics: {e}")
        return {
            "total_items_practiced": 0,
            "total_correct_answers": 0,
            "total_attempts": 0,
            "overall_accuracy": 0.0,
            "average_mastery_level": 0.0,
            "mastered_items": 0,
            "recent_sessions_count": 0,
            "recent_accuracy": 0.0,
            "avg_response_time_ms": 0,
            "items_needing_attention": 0,
        }
