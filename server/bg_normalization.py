"""
Bulgarian text normalization module.

Provides comprehensive text normalization for Bulgarian language processing,
including handling of Cyrillic-specific characters, diacritics, punctuation,
and common variations in Bulgarian text.
"""

import re
import unicodedata


class BulgarianTextNormalizer:
    """Comprehensive Bulgarian text normalization for NLP processing."""

    def __init__(self):
        # Bulgarian-specific character mappings
        self.char_replacements = {
            # Latin to Cyrillic lookalikes (common OCR/typing errors)
            "a": "а",
            "e": "е",
            "o": "о",
            "p": "р",
            "c": "с",
            "y": "у",
            "x": "х",
            "A": "А",
            "E": "Е",
            "O": "О",
            "P": "Р",
            "C": "С",
            "Y": "У",
            "X": "Х",
            "T": "Т",
            "M": "М",
            "H": "Н",
            "K": "К",
            "B": "В",
            # Alternative Cyrillic forms
            "ѐ": "е",  # Cyrillic e with grave (non-standard)
            "ѝ": "и",  # Cyrillic i with grave (used in Bulgarian)
            "ё": "е",  # Russian yo → Bulgarian e
            "ъ̀": "ъ",  # Remove combining grave from ъ
            # Unicode variations
            "\u0301": "",  # Remove combining acute accent
            "\u0300": "",  # Remove combining grave accent
        }

        # Common abbreviations in Bulgarian
        self.abbreviations = {
            "г.": "година",
            "гр.": "град",
            "ул.": "улица",
            "бул.": "булевард",
            "пл.": "площад",
            "бр.": "брой",
            "др.": "други",
            "т.н.": "така нататък",
            "и т.н.": "и така нататък",
            "напр.": "например",
            "вкл.": "включително",
            "изкл.": "изключително",
            "св.": "свети",
            "проф.": "професор",
            "д-р": "доктор",
            "инж.": "инженер",
        }

        # Number words in Bulgarian
        self.number_words = {
            "1": "едно",
            "2": "две",
            "3": "три",
            "4": "четири",
            "5": "пет",
            "6": "шест",
            "7": "седем",
            "8": "осем",
            "9": "девет",
            "10": "десет",
            "11": "единадесет",
            "12": "дванадесет",
            "13": "тринадесет",
            "14": "четиринадесет",
            "15": "петнадесет",
            "16": "шестнадесет",
            "17": "седемнадесет",
            "18": "осемнадесет",
            "19": "деветнадесет",
            "20": "двадесет",
            "30": "тридесет",
            "40": "четиридесет",
            "50": "петдесет",
            "60": "шестдесет",
            "70": "седемдесет",
            "80": "осемдесет",
            "90": "деветдесет",
            "100": "сто",
            "1000": "хиляда",
        }

    def normalize(
        self,
        text: str,
        lowercase: bool = True,
        expand_abbreviations: bool = True,
        convert_numbers: bool = False,
        remove_diacritics: bool = False,
        fix_spacing: bool = True,
        remove_punctuation: bool = False,
    ) -> str:
        """
        Normalize Bulgarian text for NLP processing.

        Args:
            text: Input text to normalize
            lowercase: Convert to lowercase
            expand_abbreviations: Expand common Bulgarian abbreviations
            convert_numbers: Convert digits to Bulgarian words
            remove_diacritics: Remove diacritical marks (ѝ → и)
            fix_spacing: Fix spacing issues around punctuation
            remove_punctuation: Remove all punctuation marks

        Returns:
            Normalized Bulgarian text
        """
        if not text:
            return ""

        # Step 1: Basic cleanup - normalize Unicode
        text = unicodedata.normalize("NFC", text)

        # Step 2: Fix mixed Latin/Cyrillic (common in informal text)
        text = self._fix_mixed_alphabets(text)

        # Step 3: Handle specific Bulgarian characters
        if remove_diacritics:
            text = self._remove_bulgarian_diacritics(text)

        # Step 4: Expand abbreviations
        if expand_abbreviations:
            text = self._expand_abbreviations(text)

        # Step 5: Convert numbers to words
        if convert_numbers:
            text = self._numbers_to_words(text)

        # Step 6: Fix spacing
        if fix_spacing:
            text = self._fix_spacing(text)

        # Step 7: Handle punctuation
        if remove_punctuation:
            text = self._remove_punctuation(text)
        else:
            text = self._normalize_punctuation(text)

        # Step 8: Case normalization
        if lowercase:
            text = text.lower()

        # Step 9: Final cleanup - remove extra spaces
        text = " ".join(text.split())

        return text.strip()

    def _fix_mixed_alphabets(self, text: str) -> str:
        """Fix text with mixed Latin and Cyrillic characters."""
        # Detect if text is primarily Cyrillic
        cyrillic_count = sum(1 for c in text if "\u0400" <= c <= "\u04ff")
        latin_count = sum(1 for c in text if "A" <= c <= "Z" or "a" <= c <= "z")

        # If mostly Cyrillic, replace Latin lookalikes
        if cyrillic_count > latin_count * 0.5:
            for latin, cyrillic in self.char_replacements.items():
                # Only replace isolated Latin characters in Cyrillic words
                text = re.sub(
                    rf"([\u0400-\u04FF]+){re.escape(latin)}([\u0400-\u04FF]*)",
                    rf"\1{cyrillic}\2",
                    text,
                )
                text = re.sub(
                    rf"([\u0400-\u04FF]*){re.escape(latin)}([\u0400-\u04FF]+)",
                    rf"\1{cyrillic}\2",
                    text,
                )

        return text

    def _remove_bulgarian_diacritics(self, text: str) -> str:
        """Remove diacritical marks specific to Bulgarian."""
        # Bulgarian uses grave accent on и and ъ for stress
        text = text.replace("ѝ", "и")  # и with grave
        text = text.replace("Ѝ", "И")  # capital И with grave
        text = text.replace("ъ̀", "ъ")  # ъ with grave
        text = text.replace("Ъ̀", "Ъ")  # capital Ъ with grave

        # Remove any remaining combining diacritical marks
        text = "".join(c for c in text if unicodedata.category(c) != "Mn")

        return text

    def _expand_abbreviations(self, text: str) -> str:
        """Expand common Bulgarian abbreviations."""
        for abbr, expanded in self.abbreviations.items():
            # Match abbreviation with word boundaries
            pattern = r"\b" + re.escape(abbr) + r"(?=\s|$|[,;!?])"
            text = re.sub(pattern, expanded, text, flags=re.IGNORECASE)

        return text

    def _numbers_to_words(self, text: str) -> str:
        """Convert numbers to Bulgarian words."""

        def convert_number(match):
            num = match.group()
            if num in self.number_words:
                return self.number_words[num]

            # Handle larger numbers
            try:
                n = int(num)
                if n <= 20:
                    return self.number_words.get(num, num)
                elif n < 100:
                    tens = (n // 10) * 10
                    ones = n % 10
                    if ones == 0:
                        return self.number_words.get(str(tens), num)
                    else:
                        return f"{self.number_words.get(str(tens), str(tens))} и {self.number_words.get(str(ones), str(ones))}"
            except ValueError:
                pass

            return num

        # Replace standalone numbers
        text = re.sub(r"\b\d+\b", convert_number, text)

        return text

    def _fix_spacing(self, text: str) -> str:
        """Fix common spacing issues in Bulgarian text."""
        # Remove spaces before punctuation
        text = re.sub(r"\s+([,.!?;:])", r"\1", text)

        # Add space after punctuation if missing
        text = re.sub(r"([,.!?;:])([А-Яа-я])", r"\1 \2", text)

        # Fix quotes spacing
        text = re.sub(r'"\s+', '"', text)
        text = re.sub(r'\s+"', '"', text)
        text = re.sub(r"„\s+", "„", text)  # Bulgarian opening quotes
        text = re.sub(r'\s+"', '"', text)  # Bulgarian closing quotes

        # Fix dash spacing
        text = re.sub(r"\s+-\s+", " – ", text)  # En dash with spaces
        text = re.sub(r"(\w)-(\w)", r"\1-\2", text)  # Hyphen without spaces

        return text

    def _remove_punctuation(self, text: str) -> str:
        """Remove all punctuation from text."""
        # Keep only Cyrillic letters, spaces, and basic Latin letters/numbers
        text = re.sub(r"[^\w\s\u0400-\u04FF]", " ", text, flags=re.UNICODE)
        return text

    def _normalize_punctuation(self, text: str) -> str:
        """Normalize punctuation marks to standard forms."""
        # Normalize quotes to Bulgarian style
        text = re.sub(r'["""]', '"', text)  # Various double quotes
        text = re.sub(r"[''']", "'", text)  # Various single quotes

        # Replace Bulgarian quotes with standard if needed
        text = text.replace("„", '"').replace('"', '"')

        # Normalize dashes
        text = text.replace("—", "–")  # Em dash to en dash
        text = text.replace("−", "-")  # Minus sign to hyphen

        # Normalize ellipsis
        text = re.sub(r"\.{2,}", "...", text)
        text = text.replace("…", "...")

        return text

    def normalize_for_asr(self, text: str) -> str:
        """
        Special normalization for ASR output processing.
        Optimized for comparing ASR transcriptions.
        """
        return self.normalize(
            text,
            lowercase=True,
            expand_abbreviations=False,  # ASR usually doesn't produce abbreviations
            convert_numbers=False,  # ASR outputs digits as words already
            remove_diacritics=True,  # ASR doesn't capture stress marks
            fix_spacing=True,
            remove_punctuation=False,  # Keep punctuation for sentence structure
        )

    def normalize_for_grammar_check(self, text: str) -> str:
        """
        Normalization for grammar checking.
        Preserves case and important punctuation.
        """
        return self.normalize(
            text,
            lowercase=False,  # Preserve case for proper nouns
            expand_abbreviations=True,  # Expand for better grammar checking
            convert_numbers=False,  # Keep numbers as is
            remove_diacritics=False,  # Keep stress marks if present
            fix_spacing=True,
            remove_punctuation=False,  # Need punctuation for grammar
        )

    def normalize_for_comparison(self, text: str) -> str:
        """
        Aggressive normalization for text comparison.
        Removes all variations to focus on core content.
        """
        return self.normalize(
            text,
            lowercase=True,
            expand_abbreviations=True,
            convert_numbers=True,
            remove_diacritics=True,
            fix_spacing=True,
            remove_punctuation=True,
        )


# Singleton instance for convenient usage
_normalizer = BulgarianTextNormalizer()


def normalize_bulgarian(text: str, mode: str = "standard") -> str:
    """
    Convenience function for Bulgarian text normalization.

    Args:
        text: Text to normalize
        mode: Normalization mode ('standard', 'asr', 'grammar', 'comparison')

    Returns:
        Normalized text
    """
    if mode == "asr":
        return _normalizer.normalize_for_asr(text)
    elif mode == "grammar":
        return _normalizer.normalize_for_grammar_check(text)
    elif mode == "comparison":
        return _normalizer.normalize_for_comparison(text)
    else:
        return _normalizer.normalize(text)
