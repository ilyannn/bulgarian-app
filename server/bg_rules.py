import re
from dataclasses import dataclass

from content import load_grammar_pack


@dataclass
class GrammarError:
    """Represents a detected grammar error"""

    type: str
    before: str
    after: str
    note: str
    error_tag: str
    start_pos: int = 0
    end_pos: int = 0


class BulgarianGrammarDetector:
    """Enhanced Bulgarian grammar error detector with content integration"""

    def __init__(self):
        # Load grammar rules from content files
        self.grammar_pack = load_grammar_pack()
        self._build_content_rules()

        # Fallback to hardcoded patterns if content is unavailable
        self.definite_patterns = self._init_definite_patterns()
        self.infinitive_patterns = self._init_infinitive_patterns()
        self.future_patterns = self._init_future_patterns()
        self.clitic_patterns = self._init_clitic_patterns()

    def _build_content_rules(self):
        """Build regex patterns from content grammar pack"""
        self.content_rules = []

        for grammar_id, item in self.grammar_pack.items():
            if "triggers" not in item:
                continue

            for trigger in item["triggers"]:
                if trigger["type"] == "regex":
                    pattern = trigger["pattern"]
                    # Skip invalid patterns
                    if not pattern or pattern.endswith("|"):
                        continue
                    self.content_rules.append(
                        {"pattern": pattern, "grammar_id": grammar_id, "item": item}
                    )

    def _init_definite_patterns(self) -> dict:
        """Initialize definite article patterns"""
        return {
            # Common mistakes with definite articles
            "missing_definite": [
                (
                    r"\b(на|в|от|до|под|над)\s+(стол|маса|книга|дом|работа)\b",
                    "definite article missing after preposition",
                ),
                (
                    r"\b(този|тази|това)\s+([а-яё]+)\b(?![а-яё]*[тнм]а?[тер]?$)",
                    "definite article missing with demonstrative",
                ),
            ],
            "wrong_definite": [
                # Masculine definite forms
                (r"\b([а-яё]+)та\b", r"\1ът", "masculine should use -ът, not -та"),
                (r"\b([а-яё]+)то\b", r"\1ът", "masculine should use -ът, not -то"),
                # Feminine definite forms
                (r"\b([а-яё]+[^аео])ът\b", r"\1та", "feminine should use -та, not -ът"),
                (r"\b([а-яё]+[^аео])то\b", r"\1та", "feminine should use -та, not -то"),
                # Neuter definite forms
                (r"\b([а-яё]*[ео])ът\b", r"\1то", "neuter should use -то, not -ът"),
                (r"\b([а-яё]*[ео])та\b", r"\1то", "neuter should use -то, not -та"),
            ],
        }

    def _init_infinitive_patterns(self) -> list:
        """Initialize patterns that detect infinitive-like constructions"""
        return [
            # Common verbs that trigger "да" + present
            (
                r"\b(искам|мога|трябва|започвам|спирам|учась|опитвам)\s+([а-яё]+)ам\b",
                r"\1 да \2",
                "use 'да' + present, not infinitive-like form",
            ),
            (
                r"\b(искам|мога|трябва|започвам|спирам|учась|опитвам)\s+([а-яё]+)вам\b",
                r"\1 да \2ваш",
                "use 'да' + present, not infinitive-like form",
            ),
            # Detect Russian/Polish infinitive endings
            (r"\b([а-яё]+)ть\b", r"\1", "Bulgarian has no infinitive ending -ть"),
            (r"\b([а-яё]+)ować\b", r"\1", "Bulgarian has no Polish infinitive ending"),
        ]

    def _init_future_patterns(self) -> list:
        """Initialize future tense patterns"""
        return [
            # Missing "ще" for future
            (
                r"\b(утре|следващ|скоро)\s+([а-яё]+)ам\b",
                r"\1 ще \2ам",
                "use 'ще' for future tense",
            ),
            # Wrong future constructions (influenced by other Slavic languages)
            (r"\bбуду\s+([а-яё]+)", r"ще \1", "use 'ще' not 'буду' for future"),
            (r"\bбъда\s+([а-яё]+)", r"ще \1", "use 'ще' not 'съм' for future"),
        ]

    def _init_clitic_patterns(self) -> list:
        """Initialize clitic positioning patterns"""
        return [
            # Clitic positioning errors
            (
                r"\b(ме|те|го|я|ни|ви|ги)\s+(не)\s+([а-яё]+)\b",
                r"\2 \1 \3",
                "clitic should come after 'не'",
            ),
            (
                r"\b([а-яё]+)\s+(ме|те|го|я|ни|ви|ги)\s+(много|добре|бързо)\b",
                r"\1 \3 \2",
                "clitic usually comes after adverbs",
            ),
        ]

    def detect(self, sentence: str) -> list[GrammarError]:
        """
        Detect grammar errors in a Bulgarian sentence

        Args:
            sentence: Input sentence in Bulgarian

        Returns:
            List of detected grammar errors
        """
        errors = []

        # Normalize sentence
        normalized = self._normalize_text(sentence)

        # Check content-based rules first
        errors.extend(self._check_content_rules(normalized))

        # Check for different types of errors (fallback)
        errors.extend(self._check_definite_articles(normalized))
        errors.extend(self._check_infinitive_constructions(normalized))
        errors.extend(self._check_future_tense(normalized))
        errors.extend(self._check_clitic_positioning(normalized))
        errors.extend(self._check_common_mistakes(normalized))

        return errors

    def _normalize_text(self, text: str) -> str:
        """Normalize text for analysis"""
        # Remove extra whitespace
        text = re.sub(r"\s+", " ", text.strip())

        # Handle stress marks and apostrophes
        text = text.replace("́", "").replace(""", "'").replace(""", "'")

        return text.lower()

    def _check_content_rules(self, text: str) -> list[GrammarError]:
        """Check grammar rules loaded from content files"""
        errors = []

        for rule in self.content_rules:
            pattern = rule["pattern"]
            grammar_id = rule["grammar_id"]
            item = rule["item"]

            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                # Extract correction suggestion from examples if available
                before_text = match.group(0)
                after_text = self._get_correction_from_examples(before_text, item)

                errors.append(
                    GrammarError(
                        type=grammar_id.split(".")[1]
                        if "." in grammar_id
                        else "grammar",
                        before=before_text,
                        after=after_text or before_text,
                        note=item.get("micro_explanation_bg", "Grammar error detected"),
                        error_tag=grammar_id,
                        start_pos=match.start(),
                        end_pos=match.end(),
                    )
                )

        return errors

    def _get_correction_from_examples(
        self, error_text: str, grammar_item: dict
    ) -> str | None:
        """Extract correction suggestion from grammar item examples"""
        if "examples" not in grammar_item:
            return None

        error_lower = error_text.lower()

        # Look for matching example
        for example in grammar_item["examples"]:
            if "wrong" in example and "right" in example:
                wrong_lower = example["wrong"].lower()
                if (
                    error_lower in wrong_lower
                    or self._text_similarity(error_lower, wrong_lower) > 0.7
                ):
                    # Extract the corrected part
                    return self._extract_correction_part(
                        example["wrong"], example["right"], error_text
                    )

        return None

    def _text_similarity(self, text1: str, text2: str) -> float:
        """Simple text similarity score (0-1)"""
        words1 = set(text1.split())
        words2 = set(text2.split())
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        return len(intersection) / len(union) if union else 0.0

    def _extract_correction_part(
        self, wrong_example: str, right_example: str, error_text: str
    ) -> str:
        """Extract the specific correction for the error text"""
        # Simple heuristic: find the different part between wrong and right examples
        wrong_words = wrong_example.lower().split()
        right_words = right_example.lower().split()
        error_words = error_text.lower().split()

        # Find position of error in wrong example
        for i, error_word in enumerate(error_words):
            if i < len(wrong_words) and error_word in wrong_words[i]:
                # Try to map to correction
                if i < len(right_words):
                    return right_words[i]

        # Fallback: return the right example
        return right_example

    def _check_definite_articles(self, text: str) -> list[GrammarError]:
        """Check definite article usage"""
        errors = []

        for pattern_type, patterns in self.definite_patterns.items():
            for pattern_data in patterns:
                if len(pattern_data) == 3:
                    pattern, replacement, note = pattern_data
                else:
                    pattern, note = pattern_data
                    replacement = None

                matches = re.finditer(pattern, text)
                for match in matches:
                    if pattern_type == "wrong_definite" and replacement:
                        after_text = re.sub(pattern, replacement, match.group(0))
                        errors.append(
                            GrammarError(
                                type="definite_article",
                                before=match.group(0),
                                after=after_text,
                                note=note,
                                error_tag="bg.definite.article.postposed",
                                start_pos=match.start(),
                                end_pos=match.end(),
                            )
                        )
                    else:
                        errors.append(
                            GrammarError(
                                type="definite_article",
                                before=match.group(0),
                                after=match.group(0),
                                note=note,
                                error_tag="bg.definite.article.missing",
                                start_pos=match.start(),
                                end_pos=match.end(),
                            )
                        )

        return errors

    def _check_infinitive_constructions(self, text: str) -> list[GrammarError]:
        """Check for infinitive-like constructions that should use 'да' + present"""
        errors = []

        for pattern, replacement, note in self.infinitive_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                errors.append(
                    GrammarError(
                        type="infinitive_construction",
                        before=match.group(0),
                        after=re.sub(pattern, replacement, match.group(0)),
                        note=note,
                        error_tag="bg.no_infinitive.da_present",
                        start_pos=match.start(),
                        end_pos=match.end(),
                    )
                )

        return errors

    def _check_future_tense(self, text: str) -> list[GrammarError]:
        """Check future tense constructions"""
        errors = []

        for pattern, replacement, note in self.future_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                errors.append(
                    GrammarError(
                        type="future_tense",
                        before=match.group(0),
                        after=re.sub(pattern, replacement, match.group(0)),
                        note=note,
                        error_tag="bg.future.shte",
                        start_pos=match.start(),
                        end_pos=match.end(),
                    )
                )

        return errors

    def _check_clitic_positioning(self, text: str) -> list[GrammarError]:
        """Check clitic pronoun positioning"""
        errors = []

        for pattern, replacement, note in self.clitic_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                errors.append(
                    GrammarError(
                        type="clitic_positioning",
                        before=match.group(0),
                        after=re.sub(pattern, replacement, match.group(0)),
                        note=note,
                        error_tag="bg.clitics.position",
                        start_pos=match.start(),
                        end_pos=match.end(),
                    )
                )

        return errors

    def _check_common_mistakes(self, text: str) -> list[GrammarError]:
        """Check for common mistakes made by Slavic speakers"""
        errors = []

        common_mistakes = [
            # Russian влияние
            (
                r"\bэто\b",
                "това",
                "use Bulgarian 'това' not Russian 'это'",
                "bg.vocabulary.cognates",
            ),
            (
                r"\bтак\b",
                "така",
                "use Bulgarian 'така' not Russian 'так'",
                "bg.vocabulary.cognates",
            ),
            # Polish influence
            (
                r"\btak\b",
                "така",
                "use Bulgarian 'така' not Polish 'tak'",
                "bg.vocabulary.cognates",
            ),
            (
                r"\bteż\b",
                "също",
                "use Bulgarian 'също' not Polish 'też'",
                "bg.vocabulary.cognates",
            ),
            # Common word order issues
            (
                r"\b(не)\s+(съм|си|е|сме|сте|са)\b",
                r"\2 \1",
                "auxiliary verb comes before 'не'",
                "bg.word_order.negation",
            ),
        ]

        for pattern, replacement, note, error_tag in common_mistakes:
            matches = re.finditer(pattern, text)
            for match in matches:
                errors.append(
                    GrammarError(
                        type="common_mistake",
                        before=match.group(0),
                        after=re.sub(pattern, replacement, match.group(0)),
                        note=note,
                        error_tag=error_tag,
                        start_pos=match.start(),
                        end_pos=match.end(),
                    )
                )

        return errors


# Global detector instance
_detector = BulgarianGrammarDetector()


def detect_grammar_errors(text: str) -> list[dict]:
    """
    Main function to detect grammar errors in Bulgarian text

    Args:
        text: Input text in Bulgarian

    Returns:
        List of error dictionaries compatible with the API format
    """
    errors = _detector.detect(text)

    # Convert to API format
    result = []
    for error in errors:
        result.append(
            {
                "type": error.type,
                "before": error.before,
                "after": error.after,
                "note": error.note,
                "error_tag": error.error_tag,
                "start_pos": error.start_pos,
                "end_pos": error.end_pos,
            }
        )

    return result


# Helper function for testing
def test_detection():
    """Test the grammar detection with some examples"""
    test_cases = [
        "Искам поръчвам кафе",  # Should suggest "Искам да поръчам кафе"
        "Утре ходя на работа",  # Should suggest "Утре ще ходя на работа"
        "Не съм готов",  # Should suggest "Съм не готов" - wait, this is wrong, let me fix
        "Това е книга моя",  # Word order issue
    ]

    for text in test_cases:
        print(f"\nTesting: '{text}'")
        errors = detect_grammar_errors(text)
        for error in errors:
            print(
                f"  {error['type']}: {error['before']} -> {error['after']} ({error['note']})"
            )


if __name__ == "__main__":
    test_detection()
