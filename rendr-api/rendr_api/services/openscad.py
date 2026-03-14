"""OpenSCAD CLI validation and PNG rendering."""

import asyncio
import base64
import re
import shutil
import tempfile
from pathlib import Path

from rendr_api.config import Settings
from rendr_api.models.responses import ValidationResult


def is_openscad_available(settings: Settings) -> bool:
    """Check if the OpenSCAD binary is accessible."""
    return shutil.which(settings.openscad_path) is not None


def parse_error_with_context(error_line: str, code: str) -> str:
    """Parse line number from OpenSCAD error and include surrounding code context.

    OpenSCAD errors look like: ERROR: <file>:<line>: <message>
    or: ERROR: Parser error: <message> in file ..., line <line>
    """
    # Pattern 1: ERROR: /path/file.scad:42: message
    match = re.search(r":(\d+):\s*(.+)$", error_line)
    if not match:
        # Pattern 2: line <N>
        match = re.search(r"line\s+(\d+)", error_line)

    if match:
        line_num = int(match.group(1))
        code_lines = code.splitlines()
        start = max(0, line_num - 3)
        end = min(len(code_lines), line_num + 2)
        context_lines = []
        for i in range(start, end):
            marker = " >> " if i == line_num - 1 else "    "
            context_lines.append(f"{marker}{i + 1}: {code_lines[i]}")
        context = "\n".join(context_lines)
        return f"{error_line}\n{context}"

    return error_line


async def validate_code(code: str, settings: Settings) -> ValidationResult:
    """Validate OpenSCAD code by running a syntax check.

    Runs: openscad -o /dev/null --export-format echo file.scad
    """
    if not is_openscad_available(settings):
        return ValidationResult(
            valid=True,
            warnings=["OpenSCAD not installed — validation skipped"],
        )

    with tempfile.NamedTemporaryFile(suffix=".scad", mode="w", delete=False) as f:
        f.write(code)
        scad_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            settings.openscad_path,
            "-o", "/dev/null",
            "--export-format", "echo",
            scad_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        stderr_text = stderr.decode("utf-8", errors="replace")

        errors = []
        warnings = []
        for line in stderr_text.splitlines():
            line_stripped = line.strip()
            if not line_stripped:
                continue
            if "ERROR" in line or "error" in line.lower():
                errors.append(parse_error_with_context(line_stripped, code))
            elif "WARNING" in line or "warning" in line.lower():
                warnings.append(line_stripped)

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )
    except asyncio.TimeoutError:
        return ValidationResult(valid=False, errors=["OpenSCAD validation timed out"])
    finally:
        Path(scad_path).unlink(missing_ok=True)


async def render_png(
    code: str, settings: Settings, width: int = 512, height: int = 512, camera: str | None = None
) -> bytes:
    """Render OpenSCAD code to PNG and return the image bytes."""
    with tempfile.NamedTemporaryFile(suffix=".scad", mode="w", delete=False) as f:
        f.write(code)
        scad_path = f.name

    png_path = scad_path.replace(".scad", ".png")

    try:
        cmd = [
            settings.openscad_path,
            "-o", png_path,
            f"--imgsize={width},{height}",
        ]
        if camera:
            cmd.append(f"--camera={camera}")
        cmd.append(scad_path)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=60)

        if proc.returncode != 0 or not Path(png_path).exists():
            raise RuntimeError("OpenSCAD render failed")

        return Path(png_path).read_bytes()
    finally:
        Path(scad_path).unlink(missing_ok=True)
        Path(png_path).unlink(missing_ok=True)


async def render_stl(code: str, settings: Settings) -> bytes:
    """Render OpenSCAD code to STL and return the binary data."""
    with tempfile.NamedTemporaryFile(suffix=".scad", mode="w", delete=False) as f:
        f.write(code)
        scad_path = f.name

    stl_path = scad_path.replace(".scad", ".stl")

    try:
        cmd = [
            settings.openscad_path,
            "-o", stl_path,
            scad_path,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=60)

        if proc.returncode != 0 or not Path(stl_path).exists():
            raise RuntimeError("OpenSCAD STL export failed")

        return Path(stl_path).read_bytes()
    finally:
        Path(scad_path).unlink(missing_ok=True)
        Path(stl_path).unlink(missing_ok=True)


def encode_png_base64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")
