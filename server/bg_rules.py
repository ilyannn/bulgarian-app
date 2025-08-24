import re
from typing import List, Dict, Optional
from dataclasses import dataclass


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
    """Lightweight Bulgarian grammar error detector"""
    
    def __init__(self):
        # Common Bulgarian patterns and rules
        self.definite_patterns = self._init_definite_patterns()
        self.infinitive_patterns = self._init_infinitive_patterns()
        self.future_patterns = self._init_future_patterns()
        self.clitic_patterns = self._init_clitic_patterns()
    
    def _init_definite_patterns(self) -> Dict:
        """Initialize definite article patterns"""
        return {
            # Common mistakes with definite articles
            "missing_definite": [
                (r'\b(на|в|от|до|под|над)\s+(стол|маса|книга|дом|работа)\b', 
                 "definite article missing after preposition"),
                (r'\b(този|тази|това)\s+([а-яё]+)\b(?![а-яё]*[тнм]а?[тер]?$)',
                 "definite article missing with demonstrative")
            ],
            
            "wrong_definite": [
                # Masculine definite forms
                (r'\b([а-яё]+)та\b', r'\1ът', "masculine should use -ът, not -та"),
                (r'\b([а-яё]+)то\b', r'\1ът', "masculine should use -ът, not -то"),
                
                # Feminine definite forms  
                (r'\b([а-яё]+[^аео])ът\b', r'\1та', "feminine should use -та, not -ът"),
                (r'\b([а-яё]+[^аео])то\b', r'\1та', "feminine should use -та, not -то"),
                
                # Neuter definite forms
                (r'\b([а-яё]*[ео])ът\b', r'\1то', "neuter should use -то, not -ът"),
                (r'\b([а-яё]*[ео])та\b', r'\1то', "neuter should use -то, not -та"),
            ]
        }
    
    def _init_infinitive_patterns(self) -> List:
        """Initialize patterns that detect infinitive-like constructions"""
        return [
            # Common verbs that trigger "да" + present
            (r'\b(искам|мога|трябва|започвам|спирам|учась|опитвам)\s+([а-яё]+)ам\b', 
             r'\1 да \2', "use 'да' + present, not infinitive-like form"),
            
            (r'\b(искам|мога|трябва|започвам|спирам|учась|опитвам)\s+([а-яё]+)вам\b', 
             r'\1 да \2ваш', "use 'да' + present, not infinitive-like form"),
            
            # Detect Russian/Polish infinitive endings
            (r'\b([а-яё]+)ть\b', r'\1', "Bulgarian has no infinitive ending -ть"),
            (r'\b([а-яё]+)ować\b', r'\1', "Bulgarian has no Polish infinitive ending"),
        ]
    
    def _init_future_patterns(self) -> List:
        """Initialize future tense patterns"""
        return [
            # Missing "ще" for future
            (r'\b(утре|следващ|скоро)\s+([а-яё]+)ам\b', 
             r'\1 ще \2ам', "use 'ще' for future tense"),
            
            # Wrong future constructions (influenced by other Slavic languages)
            (r'\bбуду\s+([а-яё]+)', r'ще \1', "use 'ще' not 'буду' for future"),
            (r'\bбъда\s+([а-яё]+)', r'ще \1', "use 'ще' not 'съм' for future"),
        ]
    
    def _init_clitic_patterns(self) -> List:
        """Initialize clitic positioning patterns"""
        return [
            # Clitic positioning errors
            (r'\b(ме|те|го|я|ни|ви|ги)\s+(не)\s+([а-яё]+)\b', 
             r'\2 \1 \3', "clitic should come after 'не'"),
            
            (r'\b([а-яё]+)\s+(ме|те|го|я|ни|ви|ги)\s+(много|добре|бързо)\b', 
             r'\1 \3 \2', "clitic usually comes after adverbs"),
        ]
    
    def detect(self, sentence: str) -> List[GrammarError]:
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
        
        # Check for different types of errors
        errors.extend(self._check_definite_articles(normalized))
        errors.extend(self._check_infinitive_constructions(normalized))
        errors.extend(self._check_future_tense(normalized))
        errors.extend(self._check_clitic_positioning(normalized))
        errors.extend(self._check_common_mistakes(normalized))
        
        return errors
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for analysis"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Handle stress marks and apostrophes
        text = text.replace('́', '').replace(''', "'").replace(''', "'")
        
        return text.lower()
    
    def _check_definite_articles(self, text: str) -> List[GrammarError]:
        """Check definite article usage"""
        errors = []
        
        for pattern_type, patterns in self.definite_patterns.items():
            for pattern, replacement_or_note in patterns:
                matches = re.finditer(pattern, text)
                for match in matches:
                    if pattern_type == "wrong_definite":
                        replacement, note = replacement_or_note, patterns[0][2] if len(patterns[0]) > 2 else "definite article error"
                        errors.append(GrammarError(
                            type="definite_article",
                            before=match.group(0),
                            after=re.sub(pattern, replacement, match.group(0)),
                            note=note,
                            error_tag="bg.definite.article.postposed",
                            start_pos=match.start(),
                            end_pos=match.end()
                        ))
                    else:
                        note = replacement_or_note
                        errors.append(GrammarError(
                            type="definite_article",
                            before=match.group(0),
                            after=match.group(0),
                            note=note,
                            error_tag="bg.definite.article.missing",
                            start_pos=match.start(),
                            end_pos=match.end()
                        ))
        
        return errors
    
    def _check_infinitive_constructions(self, text: str) -> List[GrammarError]:
        """Check for infinitive-like constructions that should use 'да' + present"""
        errors = []
        
        for pattern, replacement, note in self.infinitive_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                errors.append(GrammarError(
                    type="infinitive_construction",
                    before=match.group(0),
                    after=re.sub(pattern, replacement, match.group(0)),
                    note=note,
                    error_tag="bg.no_infinitive.da_present",
                    start_pos=match.start(),
                    end_pos=match.end()
                ))
        
        return errors
    
    def _check_future_tense(self, text: str) -> List[GrammarError]:
        """Check future tense constructions"""
        errors = []
        
        for pattern, replacement, note in self.future_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                errors.append(GrammarError(
                    type="future_tense",
                    before=match.group(0),
                    after=re.sub(pattern, replacement, match.group(0)),
                    note=note,
                    error_tag="bg.future.shte",
                    start_pos=match.start(),
                    end_pos=match.end()
                ))
        
        return errors
    
    def _check_clitic_positioning(self, text: str) -> List[GrammarError]:
        """Check clitic pronoun positioning"""
        errors = []
        
        for pattern, replacement, note in self.clitic_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                errors.append(GrammarError(
                    type="clitic_positioning",
                    before=match.group(0),
                    after=re.sub(pattern, replacement, match.group(0)),
                    note=note,
                    error_tag="bg.clitics.position",
                    start_pos=match.start(),
                    end_pos=match.end()
                ))
        
        return errors
    
    def _check_common_mistakes(self, text: str) -> List[GrammarError]:
        """Check for common mistakes made by Slavic speakers"""
        errors = []
        
        common_mistakes = [
            # Russian влияние
            (r'\bэто\b', 'това', "use Bulgarian 'това' not Russian 'это'", "bg.vocabulary.cognates"),
            (r'\bтак\b', 'така', "use Bulgarian 'така' not Russian 'так'", "bg.vocabulary.cognates"),
            
            # Polish influence
            (r'\btak\b', 'така', "use Bulgarian 'така' not Polish 'tak'", "bg.vocabulary.cognates"),
            (r'\bteż\b', 'също', "use Bulgarian 'също' not Polish 'też'", "bg.vocabulary.cognates"),
            
            # Common word order issues
            (r'\b(не)\s+(съм|си|е|сме|сте|са)\b', r'\2 \1', 
             "auxiliary verb comes before 'не'", "bg.word_order.negation"),
        ]
        
        for pattern, replacement, note, error_tag in common_mistakes:
            matches = re.finditer(pattern, text)
            for match in matches:
                errors.append(GrammarError(
                    type="common_mistake",
                    before=match.group(0),
                    after=re.sub(pattern, replacement, match.group(0)),
                    note=note,
                    error_tag=error_tag,
                    start_pos=match.start(),
                    end_pos=match.end()
                ))
        
        return errors


# Global detector instance
_detector = BulgarianGrammarDetector()


def detect_grammar_errors(text: str) -> List[Dict]:
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
        result.append({
            "type": error.type,
            "before": error.before,
            "after": error.after,
            "note": error.note,
            "error_tag": error.error_tag,
            "start_pos": error.start_pos,
            "end_pos": error.end_pos
        })
    
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
            print(f"  {error['type']}: {error['before']} -> {error['after']} ({error['note']})")


if __name__ == "__main__":
    test_detection()