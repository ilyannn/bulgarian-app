"""
Content loading and management system for Bulgarian grammar and scenarios
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Export public API
__all__ = [
    "load_grammar_pack",
    "load_scenarios",
    "load_mini_lessons",
    "get_grammar_item",
    "get_scenario",
    "get_mini_lesson",
    "get_mini_lessons_for_error",
    "get_due_mini_lessons",
]

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


def load_mini_lessons() -> dict[str, Any]:
    """
    Load mini-lessons from JSON file

    Returns:
        Dictionary mapping lesson IDs to lesson data
    """
    try:
        mini_lessons_file = CONTENT_DIR / "bg_mini_lessons.json"

        if not mini_lessons_file.exists():
            print(f"Warning: Mini-lessons file not found at {mini_lessons_file}")
            return _create_sample_mini_lessons()

        with open(mini_lessons_file, encoding="utf-8") as f:
            lessons_data = json.load(f)

        # Handle different JSON formats
        if isinstance(lessons_data, dict) and "lessons" in lessons_data:
            # New format with metadata and lessons array
            return {lesson["id"]: lesson for lesson in lessons_data["lessons"]}
        elif isinstance(lessons_data, list):
            # Legacy format - lessons as array
            return {lesson["id"]: lesson for lesson in lessons_data}
        elif isinstance(lessons_data, dict):
            # Legacy format - lessons as dictionary
            return lessons_data
        else:
            raise ValueError("Invalid mini-lessons format")

    except Exception as e:
        print(f"Error loading mini-lessons: {e}")
        return _create_sample_mini_lessons()


def get_mini_lesson(lesson_id: str) -> dict[str, Any] | None:
    """
    Get a specific mini-lesson by ID

    Args:
        lesson_id: Mini-lesson ID

    Returns:
        Mini-lesson dictionary or None if not found
    """
    mini_lessons = load_mini_lessons()
    return mini_lessons.get(lesson_id)


def get_mini_lessons_for_error(error_pattern: str) -> list[dict[str, Any]]:
    """
    Get mini-lessons that match a given error pattern

    Args:
        error_pattern: Error pattern to match against

    Returns:
        List of matching mini-lesson dictionaries
    """
    import re

    mini_lessons = load_mini_lessons()
    matching_lessons = []

    for lesson in mini_lessons.values():
        error_patterns = lesson.get("error_patterns", [])
        for pattern in error_patterns:
            if re.search(pattern, error_pattern):
                matching_lessons.append(lesson)
                break

    return matching_lessons


def get_due_mini_lessons(user_progress: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Get mini-lessons that are due for review based on SRS schedule

    Args:
        user_progress: User's SRS progress data

    Returns:
        List of mini-lessons due for review
    """
    from datetime import datetime

    mini_lessons = load_mini_lessons()
    due_lessons = []
    current_date = datetime.now().date()

    for lesson_id, lesson in mini_lessons.items():
        # Check if lesson is in user progress
        lesson_progress = user_progress.get(lesson_id)

        if not lesson_progress:
            # New lesson - add to due list
            due_lessons.append(lesson)
        else:
            # Check if review is due
            next_review = datetime.fromisoformat(
                lesson_progress.get("next_review", "")
            ).date()
            if current_date >= next_review:
                due_lessons.append(lesson)

    return due_lessons


def _create_sample_mini_lessons() -> dict[str, Any]:
    """Create sample mini-lessons for development"""
    return {
        "infinitive_correction": {
            "id": "infinitive_correction",
            "title_bg": "Корекция: Няма инфинитив",
            "title_en": "Correction: No Infinitive",
            "error_patterns": ["bg.no_infinitive.*", "infinitive_like"],
            "triggers": {
                "min_occurrences": 2,
                "time_window_hours": 24,
                "confidence_threshold": 0.7,
            },
            "duration_minutes": 2,
            "level": ["A2", "B1"],
            "content": {
                "micro_explanation_bg": "В български няма инфинитив като в други славянски езици. Вместо това използваме конструкцията 'да + сегашно време'.",
                "micro_explanation_en": "Bulgarian doesn't have an infinitive like other Slavic languages. Instead, we use the construction 'да + present tense'.",
                "contrast_notes": {
                    "PL": "Po polsku mówimy 'chcę kupić', ale po bułgarsku 'искам да купя' (chcę + да + kupię).",
                    "RU": "По-русски говорим 'хочу купить', а по-болгарски 'искам да купя' (хочу + да + куплю).",
                    "UK": "По-українськи кажемо 'хочу купити', а болгарською 'искам да купя' (хочу + да + куплю).",
                    "SR": "Na srpskom kažemo 'želim da kupim', a na bugarskom 'искам да купя' (želim + da + kupim).",
                },
                "key_examples": [
                    {
                        "wrong": "Искам купувам хляб.",
                        "right": "Искам да купя хляб.",
                        "translation_en": "I want to buy bread.",
                    },
                    {
                        "wrong": "Трябва правя домашно.",
                        "right": "Трябва да правя домашно.",
                        "translation_en": "I have to do homework.",
                    },
                ],
                "quick_drill": [
                    {
                        "prompt": "Искам _____ кафе.",
                        "options": ["пия", "да пия", "пиене"],
                        "correct": 1,
                        "explanation": "'Искам' + 'да' + сегашно време",
                    }
                ],
                "memory_tip": "Запомни: 'да' = твоят приятел за действия! Винаги слагай 'да' преди глагола.",
            },
            "srs": {"interval_days": [1, 3, 7, 21]},
        }
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
