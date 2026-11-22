"""Consent-first setup: a private venv with pinned Pillow. ffmpeg is checked, never installed."""
import subprocess
import sys
from pathlib import Path

from .paths import FFMPEG_HELP, REQUIREMENTS, REQUIREMENTS_VOICE, find_tool, venv_dir, venv_python


class SetupError(RuntimeError):
    pass


def ffmpeg_status() -> tuple[bool, str]:
    """(ok, message). Checks ffmpeg, ffprobe and the libx264 encoder."""
    exe = find_tool("ffmpeg")
    if not exe or not find_tool("ffprobe"):
        return False, FFMPEG_HELP
    r = subprocess.run([exe, "-hide_banner", "-encoders"], capture_output=True, text=True)
    if "libx264" not in r.stdout:
        return False, "ffmpeg is installed but has no libx264 encoder. Install a full build of ffmpeg."
    return True, f"ffmpeg ok ({exe})"


def confirmed(yes: bool, stdin=sys.stdin, ask=input) -> bool:
    """--yes (Claude passes it after asking the user) or an interactive y/N on a terminal."""
    if yes:
        return True
    if not stdin.isatty():
        return False
    return ask("Proceed? [y/N] ").strip().lower() in ("y", "yes")


def _pins(req: Path) -> str:
    return ", ".join(t for t in req.read_text().split() if "==" in t)


def plan(voice: bool = False) -> str:
    text = (f"Studio setup will:\n  1. create a private Python venv at {venv_dir()}\n"
            f"  2. pip install pinned, hash-checked wheels (no source builds) from PyPI into that venv only: "
            f"{_pins(REQUIREMENTS)}\n")
    if voice:
        from .models import MODELS, models_dir
        mb = sum(size for _, size in MODELS.values()) >> 20
        text += (f"  3. for AI narration: pip install pinned {_pins(REQUIREMENTS_VOICE)} (and their dependencies) "
                 f"into the same venv\n  4. download the Kokoro voice model ({mb} MB, SHA-256 verified) from "
                 f"github.com/thewh1teagle/kokoro-onnx into {models_dir()}, then make a local emotion copy of it "
                 f"(adds pitch, length and energy controls; nothing else is downloaded)\n")
    return text + "It will not touch your global Python or install system packages."


def _pip(py: Path, args: list[str]) -> None:
    r = subprocess.run([str(py), "-m", "pip", "install", "--disable-pip-version-check", "-q", "--no-input", *args],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SetupError(f"pip failed (usually no network access to pypi.org):\n{r.stderr[-1500:]}")


def setup(yes: bool, log=print, stdin=sys.stdin, ask=input, voice: bool = False) -> int:
    log(plan(voice))
    if not confirmed(yes, stdin, ask):
        raise SetupError("not confirmed, nothing was installed (pass --yes after the user agrees)")
    py = venv_python()
    if not py.exists():
        log(f"creating venv at {venv_dir()}")
        venv_dir().parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, "-m", "venv", str(venv_dir())], check=True)
    _pip(py, ["--require-hashes", "--only-binary=:all:", "-r", str(Path(REQUIREMENTS))])
    if voice:
        from .models import MODELS, ModelError, fetch
        _pip(py, ["-r", str(Path(REQUIREMENTS_VOICE))])
        try:
            for name in MODELS:
                fetch(name, log=log)
            from .models import emotion_model
            log(f"emotion voice model ready: {emotion_model().name}")
        except ModelError as e:
            raise SetupError(str(e)) from e
    ok, msg = ffmpeg_status()
    log(msg)
    log(f"python packages ready in {venv_dir()}")
    return 0 if ok else 4
