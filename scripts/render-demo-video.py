from __future__ import annotations

import json
import sys
from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont
from moviepy import AudioFileClip, ImageClip, concatenate_videoclips


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"
ARTIFACTS = ROOT / "artifacts"
STAGED = ARTIFACTS / "staged"
OUTPUT = ARTIFACTS / "ClauseTrace-demo-draft.mp4"
AUDIO = ARTIFACTS / "ClauseTrace-narration.wav"
CANVAS = (1920, 1080)
OUTPUT_CANVAS = (1280, 720)


CHAPTERS = [
    (
        "claustrace-overview.png",
        "Evidence before migration",
        "A fictional API addendum becomes reviewable engineering controls, never legal advice or production authorization.",
        0.16,
    ),
    (
        "claustrace-cited-review.png",
        "Values keep their source boundary",
        "Nutrient citations, bounds, match labels, and relative scores remain attached to each extracted value.",
        0.22,
    ),
    (
        "claustrace-source-discovery.png",
        "Discovery is not proof",
        "SerpApi finds live candidates; only an opened official source with a captured digest can become reviewed evidence.",
        0.20,
    ),
    (
        "claustrace-evidence-packet.png",
        "Open blockers stay visible",
        "The DWS packet separates accepted, proposed, and unresolved content and remains explicitly not sealed.",
        0.27,
    ),
    (
        "claustrace-mobile.png",
        "Public dry run, trusted live boundary",
        "The responsive client is credential-free; real provider routes remain server-only and fail closed.",
        0.15,
    ),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def fit_inside(
    image: Image.Image, box: tuple[int, int, int, int]
) -> tuple[Image.Image, tuple[int, int]]:
    left, top, right, bottom = box
    max_width = right - left
    max_height = bottom - top
    scale = min(max_width / image.width, max_height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    resized = image.resize(size, Image.Resampling.LANCZOS)
    return resized, (
        left + (max_width - size[0]) // 2,
        top + (max_height - size[1]) // 2,
    )


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    max_chars: int,
    text_font: ImageFont.ImageFont,
    fill: str,
    line_gap: int = 10,
) -> None:
    x, y = xy
    for line in wrap(text, width=max_chars):
        draw.text((x, y), line, font=text_font, fill=fill)
        bbox = draw.textbbox((x, y), line, font=text_font)
        y += bbox[3] - bbox[1] + line_gap


def stage_frame(source: Path, title: str, subtitle: str, index: int) -> Path:
    canvas = Image.new("RGB", CANVAS, "#0b241b")
    draw = ImageDraw.Draw(canvas)
    screenshot = Image.open(source).convert("RGB")

    draw.rectangle((0, 0, CANVAS[0], 150), fill="#ffffff")
    draw.text((86, 44), "ClauseTrace", font=font(40, bold=True), fill="#10231d")
    draw.text(
        (86, 101),
        "Cited document constraints for safer schema migrations",
        font=font(22),
        fill="#53655f",
    )
    draw.text((1690, 42), f"0{index}", font=font(58, bold=True), fill="#0b7561")

    if screenshot.width >= 1000:
        crop_height = round(screenshot.width * 9 / 16)
        crop_top = max(0, min(screenshot.height - crop_height, 0))
        screenshot = screenshot.crop(
            (0, crop_top, screenshot.width, crop_top + crop_height)
        )
        frame_box = (70, 188, 1288, 877)
        draw.rounded_rectangle(
            frame_box, radius=20, fill="#ffffff", outline="#9bbdb2", width=3
        )
        screenshot = screenshot.resize((1182, 665), Image.Resampling.LANCZOS)
        canvas.paste(screenshot, (88, 200))
        text_box = (1324, 188, 1850, 877)
        text_x = 1360
        title_y = 286
        subtitle_y = 446
        title_wrap = 23
        subtitle_wrap = 35
    else:
        frame_box = (100, 180, 730, 982)
        draw.rounded_rectangle(
            frame_box, radius=20, fill="#ffffff", outline="#9bbdb2", width=3
        )
        fitted, position = fit_inside(screenshot, (122, 202, 708, 960))
        canvas.paste(fitted, position)
        text_box = (790, 180, 1840, 982)
        text_x = 842
        title_y = 302
        subtitle_y = 470
        title_wrap = 38
        subtitle_wrap = 64

    draw.rounded_rectangle(text_box, radius=20, fill="#12382c", outline="#4c7769", width=2)
    draw.text((text_x, 226), "EVIDENCE-BOUND DEMO", font=font(18, bold=True), fill="#8bd3bd")
    draw_wrapped(
        draw,
        title,
        (text_x, title_y),
        title_wrap,
        font(42, bold=True),
        "#ffffff",
        line_gap=8,
    )
    draw_wrapped(
        draw,
        subtitle,
        (text_x, subtitle_y),
        subtitle_wrap,
        font(25),
        "#cce5dc",
        line_gap=10,
    )
    draw.text(
        (86, 1028),
        "Synthetic data · no provider keys · no production writes",
        font=font(20),
        fill="#9fc6b9",
    )

    STAGED.mkdir(parents=True, exist_ok=True)
    destination = STAGED / f"chapter-{index:02d}.png"
    canvas.resize(OUTPUT_CANVAS, Image.Resampling.LANCZOS).save(destination, quality=94)
    return destination


def main() -> int:
    if not AUDIO.exists():
        print(f"Missing narration audio: {AUDIO}", file=sys.stderr)
        return 2

    missing = [ASSETS / entry[0] for entry in CHAPTERS if not (ASSETS / entry[0]).exists()]
    if missing:
        print("Missing screenshots:\n" + "\n".join(str(path) for path in missing), file=sys.stderr)
        return 2

    audio = AudioFileClip(str(AUDIO))
    if not 120 <= audio.duration <= 240:
        print(
            f"Narration must be between 120 and 240 seconds; got {audio.duration:.2f}",
            file=sys.stderr,
        )
        audio.close()
        return 2

    staged = [
        stage_frame(ASSETS / filename, title, subtitle, index + 1)
        for index, (filename, title, subtitle, _) in enumerate(CHAPTERS)
    ]
    durations = [audio.duration * weight for *_, weight in CHAPTERS]
    clips = [
        ImageClip(str(path)).with_duration(duration)
        for path, duration in zip(staged, durations, strict=True)
    ]
    video = concatenate_videoclips(clips, method="compose").with_audio(audio)
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    video.write_videofile(
        str(OUTPUT),
        fps=12,
        codec="libx264",
        audio_codec="aac",
        bitrate="1800k",
        audio_bitrate="160k",
        preset="medium",
        threads=4,
        logger=None,
    )
    duration = video.duration
    audio.close()
    video.close()
    for clip in clips:
        clip.close()

    print(
        json.dumps(
            {
                "ok": True,
                "output": str(OUTPUT),
                "durationSeconds": round(duration, 2),
                "resolution": "1280x720",
                "fps": 12,
                "chapters": len(CHAPTERS),
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
