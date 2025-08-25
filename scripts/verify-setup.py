#!/usr/bin/env python3
"""
Setup verification script for Bulgarian Voice Coach

This script validates that all dependencies and configurations
are properly set up for development and production use.
"""

import json
import subprocess
import sys
from pathlib import Path

# Add server directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "server"))


class Colors:
    """Terminal color codes for pretty output"""

    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    END = "\033[0m"


class SetupVerifier:
    """Comprehensive setup verification"""

    def __init__(self):
        self.issues = []
        self.warnings = []
        self.successes = []
        self.project_root = Path(__file__).parent.parent

    def print_header(self, title: str):
        """Print a section header"""
        print(f"\n{Colors.BLUE}{Colors.BOLD}{'=' * 60}{Colors.END}")
        print(f"{Colors.BLUE}{Colors.BOLD}{title.center(60)}{Colors.END}")
        print(f"{Colors.BLUE}{Colors.BOLD}{'=' * 60}{Colors.END}")

    def print_success(self, message: str):
        """Print a success message"""
        print(f"{Colors.GREEN}✅ {message}{Colors.END}")
        self.successes.append(message)

    def print_warning(self, message: str):
        """Print a warning message"""
        print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")
        self.warnings.append(message)

    def print_error(self, message: str):
        """Print an error message"""
        print(f"{Colors.RED}❌ {message}{Colors.END}")
        self.issues.append(message)

    def check_python_version(self):
        """Check Python version"""
        self.print_header("Python Environment")

        version = sys.version_info
        if version >= (3, 11):
            self.print_success(
                f"Python {version.major}.{version.minor}.{version.micro} is supported"
            )
        elif version >= (3, 9):
            self.print_warning(
                f"Python {version.major}.{version.minor}.{version.micro} works but 3.11+ is recommended"
            )
        else:
            self.print_error(
                f"Python {version.major}.{version.minor}.{version.micro} is too old. Need 3.9+"
            )

    def check_system_dependencies(self):
        """Check system dependencies"""
        self.print_header("System Dependencies")

        # Check uv
        if self.check_command("uv", ["--version"]):
            self.print_success("uv package manager is installed")
        else:
            self.print_error(
                "uv package manager not found. Install from: https://github.com/astral-sh/uv"
            )

        # Check bun
        if self.check_command("bun", ["--version"]):
            self.print_success("bun runtime is installed")
        else:
            self.print_error("bun runtime not found. Install from: https://bun.sh/")

        # Check just
        if self.check_command("just", ["--version"]):
            self.print_success("just command runner is installed")
        else:
            self.print_error(
                "just command runner not found. Install from: https://github.com/casey/just"
            )

        # Check eSpeak NG
        if self.check_command("espeak-ng", ["--version"]) or self.check_command(
            "espeak", ["--version"]
        ):
            self.print_success("eSpeak NG text-to-speech is installed")
        else:
            self.print_error(
                "eSpeak NG not found. Install with: apt-get install espeak-ng (Linux) or brew install espeak (macOS)"
            )

        # Check Docker (optional)
        if self.check_command("docker", ["--version"]):
            self.print_success("Docker is installed (for security scanning)")
        else:
            self.print_warning(
                "Docker not found (optional, needed for security scanning)"
            )

    def check_command(self, command: str, args: list[str] = None) -> bool:
        """Check if a command is available"""
        try:
            if args is None:
                args = ["--help"]
            result = subprocess.run([command] + args, capture_output=True, timeout=10)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def check_project_structure(self):
        """Check project directory structure"""
        self.print_header("Project Structure")

        required_files = [
            "justfile",
            "server/app.py",
            "server/asr.py",
            "server/tts.py",
            "server/llm.py",
            "server/bg_rules.py",
            "server/content/bg_grammar_pack.json",
            "server/content/bg_scenarios_with_grammar.json",
            "client/index.html",
            "client/main.js",
            "client/audio-worklet.js",
            "client/assets/fonts/Ysabeau-VariableFont_wght.ttf",
            ".env.example",
        ]

        for file_path in required_files:
            full_path = self.project_root / file_path
            if full_path.exists():
                self.print_success(f"Found {file_path}")
            else:
                self.print_error(f"Missing required file: {file_path}")

    def check_python_dependencies(self):
        """Check Python dependencies installation"""
        self.print_header("Python Dependencies")

        try:
            # Check if uv environment exists
            result = subprocess.run(
                [
                    "uv",
                    "run",
                    "python",
                    "-c",
                    "import sys; print('Python environment OK')",
                ],
                capture_output=True,
                text=True,
                cwd=self.project_root,
            )
            if result.returncode == 0:
                self.print_success("Python dependencies are installed")

                # Check specific important packages
                important_packages = [
                    "fastapi",
                    "uvicorn",
                    "faster-whisper",
                    "pydantic",
                    "websockets",
                    "openai",
                    "anthropic",
                ]

                for package in important_packages:
                    try:
                        result = subprocess.run(
                            ["uv", "run", "python", "-c", f"import {package}"],
                            capture_output=True,
                            cwd=self.project_root,
                        )
                        if result.returncode == 0:
                            self.print_success(f"✓ {package}")
                        else:
                            self.print_warning(
                                f"Package {package} may not be installed"
                            )
                    except Exception:
                        self.print_warning(f"Could not verify {package}")
            else:
                self.print_error("Python dependencies not installed. Run: just install")
        except FileNotFoundError:
            self.print_error("Cannot check Python dependencies. Is uv installed?")

    def check_javascript_dependencies(self):
        """Check JavaScript dependencies installation"""
        self.print_header("JavaScript Dependencies")

        package_json = self.project_root / "client" / "package.json"
        node_modules = self.project_root / "client" / "node_modules"

        if package_json.exists():
            self.print_success("Found client/package.json")

            if node_modules.exists():
                self.print_success("JavaScript dependencies are installed")

                # Check if bun can run commands
                try:
                    result = subprocess.run(
                        ["bun", "run", "--help"],
                        capture_output=True,
                        cwd=self.project_root / "client",
                    )
                    if result.returncode == 0:
                        self.print_success("Bun can execute in client directory")
                    else:
                        self.print_warning("Bun execution may have issues")
                except Exception:
                    self.print_error("Cannot run bun commands")
            else:
                self.print_error(
                    "JavaScript dependencies not installed. Run: just install"
                )
        else:
            self.print_error("client/package.json not found")

    def check_environment_config(self):
        """Check environment configuration"""
        self.print_header("Environment Configuration")

        env_example = self.project_root / ".env.example"
        env_file = self.project_root / ".env"

        if env_example.exists():
            self.print_success("Found .env.example")
        else:
            self.print_error("Missing .env.example file")

        if env_file.exists():
            self.print_success("Found .env configuration file")

            # Try to validate environment using the config module
            try:
                from config import ConfigError, validate_startup_environment

                config = validate_startup_environment()
                self.print_success("Environment configuration is valid")
                self.print_success(f"LLM Provider: {config.chat_provider}")
                self.print_success(f"Default L1 Language: {config.default_l1_language}")

            except ConfigError as e:
                self.print_error(f"Environment validation failed: {e}")
            except ImportError:
                self.print_warning("Could not import config module for validation")
            except Exception as e:
                self.print_warning(f"Environment validation had issues: {e}")
        else:
            self.print_warning(
                "No .env file found. Copy .env.example to .env and configure it"
            )

    def check_content_files(self):
        """Check content files"""
        self.print_header("Content System")

        content_files = {
            "server/content/bg_grammar_pack.json": "Bulgarian grammar rules",
            "server/content/bg_scenarios_with_grammar.json": "Conversational scenarios",
        }

        for file_path, description in content_files.items():
            full_path = self.project_root / file_path
            if full_path.exists():
                try:
                    with open(full_path, encoding="utf-8") as f:
                        data = json.load(f)

                    if "items" in data:
                        count = len(data["items"])
                        self.print_success(f"Found {description} with {count} items")
                    else:
                        self.print_success(f"Found {description}")

                except json.JSONDecodeError:
                    self.print_error(f"Invalid JSON in {file_path}")
                except Exception as e:
                    self.print_warning(f"Could not read {file_path}: {e}")
            else:
                self.print_error(f"Missing {description}: {file_path}")

    def check_fonts(self):
        """Check font files"""
        self.print_header("Typography (Fonts)")

        font_dir = self.project_root / "client" / "assets" / "fonts"
        required_fonts = [
            "Ysabeau-VariableFont_wght.ttf",
            "Ysabeau-Italic-VariableFont_wght.ttf",
            "OFL.txt",
        ]

        if font_dir.exists():
            self.print_success("Font directory exists")

            for font_file in required_fonts:
                font_path = font_dir / font_file
                if font_path.exists():
                    size_mb = font_path.stat().st_size / (1024 * 1024)
                    self.print_success(f"Found {font_file} ({size_mb:.1f} MB)")
                else:
                    self.print_error(f"Missing font file: {font_file}")
        else:
            self.print_error("Font directory not found")

    def run_basic_tests(self):
        """Run basic functionality tests"""
        self.print_header("Basic Functionality Tests")

        # Test justfile recipes
        recipes_to_test = ["lint", "format", "test"]

        for recipe in recipes_to_test:
            try:
                print(f"Testing just {recipe}...")
                result = subprocess.run(
                    ["just", recipe],
                    capture_output=True,
                    text=True,
                    cwd=self.project_root,
                    timeout=60,
                )
                if result.returncode == 0:
                    self.print_success(f"just {recipe} - passed")
                else:
                    self.print_error(f"just {recipe} - failed: {result.stderr.strip()}")
            except subprocess.TimeoutExpired:
                self.print_error(f"just {recipe} - timed out")
            except Exception as e:
                self.print_error(f"just {recipe} - error: {e}")

    def print_summary(self):
        """Print final summary"""
        self.print_header("Setup Verification Summary")

        if self.successes:
            print(
                f"{Colors.GREEN}✅ Successful checks: {len(self.successes)}{Colors.END}"
            )

        if self.warnings:
            print(f"{Colors.YELLOW}⚠️  Warnings: {len(self.warnings)}{Colors.END}")
            for warning in self.warnings[:3]:  # Show first 3 warnings
                print(f"   • {warning}")
            if len(self.warnings) > 3:
                print(f"   ... and {len(self.warnings) - 3} more warnings")

        if self.issues:
            print(f"{Colors.RED}❌ Issues found: {len(self.issues)}{Colors.END}")
            for issue in self.issues[:3]:  # Show first 3 issues
                print(f"   • {issue}")
            if len(self.issues) > 3:
                print(f"   ... and {len(self.issues) - 3} more issues")

        print(f"\n{Colors.BOLD}Overall status:{Colors.END}")
        if not self.issues:
            if not self.warnings:
                print(
                    f"{Colors.GREEN}🎉 Perfect! Your setup is ready for development.{Colors.END}"
                )
            else:
                print(
                    f"{Colors.YELLOW}✅ Good! Setup is functional with minor warnings.{Colors.END}"
                )
            return True
        elif len(self.issues) <= 2:
            print(
                f"{Colors.YELLOW}⚠️  Setup has some issues but may still work.{Colors.END}"
            )
            return False
        else:
            print(
                f"{Colors.RED}❌ Setup has significant issues that need to be resolved.{Colors.END}"
            )
            return False

    def run_verification(self):
        """Run complete verification"""
        print(f"{Colors.BLUE}{Colors.BOLD}")
        print("🇧🇬 Bulgarian Voice Coach - Setup Verification")
        print("=" * 60)
        print(f"{Colors.END}")

        self.check_python_version()
        self.check_system_dependencies()
        self.check_project_structure()
        self.check_python_dependencies()
        self.check_javascript_dependencies()
        self.check_environment_config()
        self.check_content_files()
        self.check_fonts()
        self.run_basic_tests()

        return self.print_summary()


if __name__ == "__main__":
    verifier = SetupVerifier()
    success = verifier.run_verification()
    sys.exit(0 if success else 1)
