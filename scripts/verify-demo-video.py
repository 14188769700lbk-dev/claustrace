from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import VideoFileClip


ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / "artifacts" / "ClauseTrace-demo-draft.mp4"
CONTACT_SHEET = ROOT / "artifacts" / "ClauseTrace-demo-contact-sheet.png"
SAMPLE_FRACTIONS = [0.08, 0.27, 0.48, 0.715, 0.925]


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in [
        Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def main() -> int:
    if not VIDEO.exists():
        print(f"Missing video: {VIDEO}", file=sys.stderr)
        return 2

    video = VideoFileClip(str(VIDEO))
    errors: list[str] = []
    decoded_frames = 0
    audio_samples = 0
    audio_square_sum = 0.0

    try:
        if not 120 <= video.duration <= 240:
            errors.append(f"duration {video.duration:.2f}s is outside 120–240s")
        if tuple(video.size) != (1280, 720):
            errors.append(f"unexpected resolution {tuple(video.size)}")
        if not math.isclose(video.fps, 12, rel_tol=0.02):
            errors.append(f"unexpected frame rate {video.fps}")
        if video.audio is None:
            errors.append("audio track is missing")

        sample_times = [video.duration * fraction for fraction in SAMPLE_FRACTIONS]
        sample_images = [
            Image.fromarray(video.get_frame(timestamp)).convert("RGB")
            for timestamp in sample_times
        ]

        for _ in video.iter_frames(dtype="uint8"):
            decoded_frames += 1

        if video.audio is not None:
            for chunk in video.audio.iter_chunks(chunksize=44_100, fps=22_050):
                values = np.asarray(chunk, dtype=np.float64)
                audio_samples += values.size
                audio_square_sum += float(np.square(values).sum())

        if decoded_frames < 2_400:
            errors.append(f"only {decoded_frames} video frames decoded")
        audio_rms = (
            math.sqrt(audio_square_sum / audio_samples) if audio_samples else 0.0
        )
        if audio_rms < 0.001:
            errors.append(f"audio RMS is unexpectedly low: {audio_rms:.6f}")

        thumb_size = (480, 270)
        label_height = 38
        sheet = Image.new("RGB", (960, (270 + label_height) * 3), "#0b241b")
        draw = ImageDraw.Draw(sheet)
        text_font = font(18)
        for index, (image, timestamp) in enumerate(zip(sample_images, sample_times, strict=True)):
            row, column = divmod(index, 2)
            x = column * thumb_size[0]
            y = row * (thumb_size[1] + label_height)
            sheet.paste(image.resize(thumb_size, Image.Resampling.LANCZOS), (x, y))
            draw.text(
                (x + 12, y + thumb_size[1] + 8),
                f"sample {index + 1} · {timestamp:.1f}s",
                font=text_font,
                fill="#ffffff",
            )
        CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(CONTACT_SHEET)

        result = {
            "ok": not errors,
            "video": str(VIDEO),
            "bytes": VIDEO.stat().st_size,
            "durationSeconds": round(video.duration, 2),
            "resolution": list(video.size),
            "fps": video.fps,
            "decodedFrames": decoded_frames,
            "audioSamples": audio_samples,
            "audioRms": round(audio_rms, 6),
            "contactSheet": str(CONTACT_SHEET),
            "errors": errors,
        }
        print(json.dumps(result))
        return 0 if not errors else 1
    finally:
        video.close()


if __name__ == "__main__":
    raise SystemExit(main())
