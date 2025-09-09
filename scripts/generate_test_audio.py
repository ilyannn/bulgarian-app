#!/usr/bin/env python3
"""
Generate Bulgarian Test Audio Samples

Creates realistic Bulgarian audio samples for benchmarking ASR performance.
Uses eSpeak NG for consistent, reproducible audio generation.

Usage:
    python scripts/generate_test_audio.py [--output-dir test_audio_samples] [--count 10]
"""

import argparse
import subprocess
import sys
from pathlib import Path


class BulgarianAudioGenerator:
    """Generate Bulgarian audio samples for testing"""

    def __init__(self, output_dir: Path = None):
        self.output_dir = output_dir or Path("test_audio_samples")
        self.output_dir.mkdir(exist_ok=True)

        # Bulgarian test phrases of varying complexity and length
        self.test_phrases = [
            # Short greetings (1-2 seconds)
            "Здравей!",  # Hello!
            "Довиждане!",  # Goodbye!
            "Благодаря!",  # Thank you!
            "Извинете!",  # Excuse me!
            # Medium sentences (3-5 seconds)
            "Как се казвате?",  # What is your name?
            "Откъде сте?",  # Where are you from?
            "Колко е часът?",  # What time is it?
            "Къде е гарата?",  # Where is the station?
            "Говорите ли английски?",  # Do you speak English?
            "Аз уча български.",  # I am learning Bulgarian.
            # Longer phrases (5-8 seconds)
            "Моля, можете ли да ми помогнете?",  # Please, can you help me?
            "Искам да купя билет за София.",  # I want to buy a ticket to Sofia.
            "Времето днес е много хубаво.",  # The weather today is very nice.
            "Обичам българската кухня много.",  # I love Bulgarian cuisine very much.
            "Къде мога да намеря добър ресторант?",  # Where can I find a good restaurant?
            # Complex sentences (8-12 seconds)
            "Извинете, можете ли да ми кажете как да стигна до центъра?",  # Excuse me, can you tell me how to get to the center?
            "Бих искал да направя резервация за двама души за довечера.",  # I would like to make a reservation for two people for tonight.
            "Моля, говорете по-бавно, защото все още уча българския език.",  # Please speak slower because I'm still learning Bulgarian.
            "Най-добрата българска храна се прави у дома от бабите.",  # The best Bulgarian food is made at home by grandmothers.
            # Grammar-focused phrases (testing specific patterns)
            "Не съм българин, но говоря български.",  # I'm not Bulgarian, but I speak Bulgarian. (negation)
            "Ако имах време, щях да отида в театъра.",  # If I had time, I would go to the theater. (conditional)
            "Книгата, която чета, е много интересна.",  # The book that I'm reading is very interesting. (relative clause)
            "Трябва да си тръгвам, защото закъснявам.",  # I have to leave because I'm running late. (modal + causation)
            # Numbers and dates
            "Днес е двадесет и първи януари.",  # Today is January 21st.
            "Имам тридесет и пет години.",  # I am thirty-five years old.
            "Магазинът работи от осем до осемнадесет часа.",  # The store is open from 8 to 18 hours.
            # Cultural references
            "София е столицата на България.",  # Sofia is the capital of Bulgaria.
            "Черното море е красиво през лятото.",  # The Black Sea is beautiful in summer.
            "Българският език е част от южнославянската група.",  # Bulgarian is part of the South Slavic group.
        ]

    def check_espeak_availability(self) -> bool:
        """Check if eSpeak NG is available"""
        try:
            result = subprocess.run(
                ["espeak-ng", "--version"], capture_output=True, text=True, timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def generate_audio_file(
        self,
        text: str,
        output_file: Path,
        voice: str = "bg",
        speed: int = 150,
        pitch: int = 50,
    ) -> bool:
        """Generate audio file using eSpeak NG"""
        cmd = [
            "espeak-ng",
            "-v",
            voice,  # Bulgarian voice
            "-s",
            str(speed),  # Words per minute
            "-p",
            str(pitch),  # Pitch (0-99)
            "-w",
            str(output_file),  # Output WAV file
            text,
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode == 0:
                print(
                    f"✅ Created {output_file.name}: '{text[:50]}{'...' if len(text) > 50 else ''}'"
                )
                return True
            else:
                print(
                    f"❌ Failed to create {output_file.name}: {result.stderr.strip()}"
                )
                return False

        except subprocess.TimeoutExpired:
            print(f"⏰ Timeout creating {output_file.name}")
            return False
        except Exception as e:
            print(f"❌ Error creating {output_file.name}: {e}")
            return False

    def generate_variations(self, text: str, base_filename: str) -> list[Path]:
        """Generate multiple variations of the same text with different speech parameters"""
        files = []

        variations = [
            ("normal", {"speed": 150, "pitch": 50}),
            ("slow", {"speed": 120, "pitch": 50}),
            ("fast", {"speed": 180, "pitch": 50}),
            ("low_pitch", {"speed": 150, "pitch": 30}),
            ("high_pitch", {"speed": 150, "pitch": 70}),
        ]

        for suffix, params in variations:
            output_file = self.output_dir / f"{base_filename}_{suffix}.wav"
            if self.generate_audio_file(text, output_file, **params):
                files.append(output_file)

        return files

    def generate_all_samples(
        self, count: int = None, include_variations: bool = False
    ) -> list[Path]:
        """Generate all audio samples"""
        phrases_to_use = self.test_phrases[:count] if count else self.test_phrases
        generated_files = []

        print(f"🎵 Generating {len(phrases_to_use)} Bulgarian audio samples...")
        if include_variations:
            print("   Including speech parameter variations")

        if not self.check_espeak_availability():
            print("❌ eSpeak NG not found!")
            print(
                "   Install with: brew install espeak (macOS) or apt-get install espeak-ng (Linux)"
            )
            return []

        for i, phrase in enumerate(phrases_to_use, 1):
            base_filename = f"bg_sample_{i:02d}"

            if include_variations:
                # Generate multiple variations
                files = self.generate_variations(phrase, base_filename)
                generated_files.extend(files)
            else:
                # Generate single normal version
                output_file = self.output_dir / f"{base_filename}.wav"
                if self.generate_audio_file(phrase, output_file):
                    generated_files.append(output_file)

        print(f"\n✅ Generated {len(generated_files)} audio files in {self.output_dir}")
        return generated_files

    def generate_metadata(self, files: list[Path]) -> None:
        """Generate metadata file with information about the samples"""
        metadata = {
            "generated_samples": len(files),
            "output_directory": str(self.output_dir),
            "samples": [],
        }

        for i, phrase in enumerate(self.test_phrases[: len(files)], 1):
            # Estimate difficulty and length category
            word_count = len(phrase.split())
            char_count = len(phrase)

            if word_count <= 2:
                difficulty = "easy"
                category = "short"
            elif word_count <= 6:
                difficulty = "medium"
                category = "medium"
            else:
                difficulty = "hard"
                category = "long"

            metadata["samples"].append(
                {
                    "id": f"bg_sample_{i:02d}",
                    "text": phrase,
                    "word_count": word_count,
                    "char_count": char_count,
                    "difficulty": difficulty,
                    "category": category,
                    "estimated_duration_seconds": word_count * 0.6,  # Rough estimate
                }
            )

        metadata_file = self.output_dir / "samples_metadata.json"
        import json

        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        print(f"📋 Metadata saved to {metadata_file}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Generate Bulgarian audio samples for ASR benchmarking"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default="test_audio_samples",
        help="Output directory for audio files",
    )
    parser.add_argument(
        "--count", type=int, help="Number of samples to generate (default: all)"
    )
    parser.add_argument(
        "--variations",
        action="store_true",
        help="Generate speech parameter variations for each phrase",
    )
    parser.add_argument(
        "--list-phrases",
        action="store_true",
        help="List all available phrases and exit",
    )

    args = parser.parse_args()

    generator = BulgarianAudioGenerator(args.output_dir)

    if args.list_phrases:
        print("Available Bulgarian phrases:")
        print("=" * 50)
        for i, phrase in enumerate(generator.test_phrases, 1):
            print(f"{i:2d}. {phrase}")
        return

    # Generate audio samples
    files = generator.generate_all_samples(
        count=args.count, include_variations=args.variations
    )

    if files:
        # Generate metadata
        generator.generate_metadata(files)
        print(f"\n🎯 Ready for benchmarking with {len(files)} audio files!")
    else:
        print("\n❌ No audio files were generated.")
        sys.exit(1)


if __name__ == "__main__":
    main()
