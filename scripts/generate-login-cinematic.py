from __future__ import annotations

import math
import os
import random
import subprocess
from pathlib import Path

import numpy as np

W, H = 960, 540
FPS = 24
SECONDS = 8
FRAMES = FPS * SECONDS
OUT = Path("public/media/scenova-login-cinematic-4k.mp4")
OUT.parent.mkdir(parents=True, exist_ok=True)

rng = random.Random(20260826)
xx = np.arange(W, dtype=np.float32)[None, :]
yy = np.arange(H, dtype=np.float32)[:, None]

# Deep navy / violet cinematic base with a neon horizon.
y_norm = yy / H
x_norm = xx / W
base = np.zeros((H, W, 3), dtype=np.float32)
base[..., 0] = 5 + 9 * (1 - y_norm) + 12 * np.exp(-((y_norm - 0.62) / 0.19) ** 2)
base[..., 1] = 6 + 7 * (1 - y_norm) + 8 * np.exp(-((y_norm - 0.62) / 0.18) ** 2)
base[..., 2] = 15 + 26 * (1 - y_norm) + 32 * np.exp(-((y_norm - 0.60) / 0.20) ** 2)
base += (6 * np.sin(x_norm * math.pi * 2))[..., None]
base = np.clip(base, 0, 255).astype(np.uint8)

buildings: list[tuple[int, int, int, int, tuple[int, int, int]]] = []
x = -20
while x < W + 40:
    bw = rng.randint(26, 74)
    bh = rng.randint(70, 240)
    tone = rng.choice([(8, 9, 18), (10, 10, 22), (12, 8, 24), (7, 12, 22)])
    buildings.append((x, H - 70 - bh, bw, bh, tone))
    x += bw + rng.randint(4, 16)

particles = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(0.4, 2.5), rng.choice((0, 1))) for _ in range(140)]

def rect(frame: np.ndarray, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int]) -> None:
    x0, x1 = max(0, x0), min(W, x1)
    y0, y1 = max(0, y0), min(H, y1)
    if x1 > x0 and y1 > y0:
        frame[y0:y1, x0:x1] = color

def circle(frame: np.ndarray, cx: int, cy: int, r: int, color: tuple[int, int, int]) -> None:
    y0, y1 = max(0, cy-r), min(H, cy+r+1)
    x0, x1 = max(0, cx-r), min(W, cx+r+1)
    if x1 <= x0 or y1 <= y0:
        return
    sy, sx = np.ogrid[y0:y1, x0:x1]
    mask = (sx-cx) ** 2 + (sy-cy) ** 2 <= r ** 2
    block = frame[y0:y1, x0:x1]
    block[mask] = color

def draw_silhouette(frame: np.ndarray, cx: int, floor: int, scale: float, facing: int) -> None:
    dark = (3, 4, 9)
    head_r = max(5, int(10 * scale))
    circle(frame, cx, floor - int(112 * scale), head_r, dark)
    rect(frame, cx-int(13*scale), floor-int(100*scale), cx+int(13*scale), floor-int(48*scale), dark)
    rect(frame, cx-int(11*scale), floor-int(49*scale), cx-int(1*scale), floor, dark)
    rect(frame, cx+int(1*scale), floor-int(49*scale), cx+int(11*scale), floor, dark)
    # Arm / energy weapon silhouette.
    arm_y = floor - int(82*scale)
    rect(frame, cx if facing > 0 else cx-int(42*scale), arm_y, cx+int(42*scale) if facing > 0 else cx, arm_y+int(8*scale), dark)

def make_frame(n: int) -> np.ndarray:
    t = n / FPS
    frame = base.copy()

    # Horizon glow pulses.
    pulse = 0.55 + 0.45 * math.sin(t * 1.65) ** 2
    horizon = np.exp(-((yy - H*0.66) / 46.0) ** 2)
    frame[..., 0] = np.clip(frame[..., 0].astype(np.float32) + horizon * (38 * pulse), 0, 255).astype(np.uint8)
    frame[..., 2] = np.clip(frame[..., 2].astype(np.float32) + horizon * (58 * pulse), 0, 255).astype(np.uint8)

    # Parallax cyber city.
    drift = int(10 * math.sin(t * 0.38))
    for i, (bx, by, bw, bh, tone) in enumerate(buildings):
        x0 = bx + drift
        rect(frame, x0, by, x0+bw, by+bh, tone)
        neon = (20, 130, 190) if i % 2 == 0 else (160, 25, 125)
        for wy in range(by + 12, by + bh - 10, 18):
            for wx in range(x0 + 8, x0 + bw - 6, 14):
                if ((wx + wy + n//6 + i) % 5) == 0:
                    rect(frame, wx, wy, wx+3, wy+6, neon)

    # Ground and reflective neon lanes.
    rect(frame, 0, H-70, W, H, (4, 5, 10))
    for lane, c in ((0.28, (15, 205, 255)), (0.72, (255, 30, 170))):
        lx = int(W * lane + 30 * math.sin(t * 0.9 + lane*4))
        rect(frame, lx-2, H-66, lx+2, H, c)

    # Two opposing combat silhouettes.
    draw_silhouette(frame, int(W*0.38 + math.sin(t*1.3)*12), H-68, 1.08, 1)
    draw_silhouette(frame, int(W*0.64 - math.sin(t*1.2)*10), H-68, 1.12, -1)

    # Animated energy streaks / weapon trails.
    cyan_center = H*0.47 + 34*np.sin(t*1.9) + (xx - W*0.30) * 0.18
    mag_center = H*0.44 - 28*np.sin(t*1.7 + 1.2) - (xx - W*0.68) * 0.16
    cyan_dist = np.abs(yy - cyan_center)
    mag_dist = np.abs(yy - mag_center)
    cyan_glow = np.exp(-(cyan_dist/8.0)**2)
    mag_glow = np.exp(-(mag_dist/9.0)**2)
    f = frame.astype(np.float32)
    f[..., 0] += cyan_glow * 22 + mag_glow * 115
    f[..., 1] += cyan_glow * 118 + mag_glow * 18
    f[..., 2] += cyan_glow * 160 + mag_glow * 92

    # Sparks / particles travel toward camera.
    for px, py, speed, color_idx in particles:
        x = int((px + t * speed * 46) % W)
        y = int((py + t * speed * 24) % H)
        c = (55, 210, 255) if color_idx == 0 else (255, 70, 176)
        r = 1 if speed < 1.4 else 2
        x0, x1 = max(0, x-r), min(W, x+r+1)
        y0, y1 = max(0, y-r), min(H, y+r+1)
        if x1 > x0 and y1 > y0:
            f[y0:y1, x0:x1, 0] += c[0] * 0.75
            f[y0:y1, x0:x1, 1] += c[1] * 0.75
            f[y0:y1, x0:x1, 2] += c[2] * 0.75

    # Blockbuster impact flashes.
    for impact in (2.05, 5.25):
        delta = abs(t-impact)
        if delta < 0.13:
            strength = (1 - delta/0.13) * 95
            f += strength

    # Scanlines and vignette.
    f[::4] *= 0.84
    dx = (xx - W/2) / (W/2)
    dy = (yy - H/2) / (H/2)
    vignette = np.clip(1.08 - 0.48*(dx*dx + dy*dy), 0.52, 1.0)
    f *= vignette[..., None]
    return np.clip(f, 0, 255).astype(np.uint8)

cmd = [
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
    "-an", "-vf", "scale=3840:2160:flags=bicubic,format=yuv420p",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-maxrate", "6M", "-bufsize", "12M",
    "-movflags", "+faststart", str(OUT),
]

proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
assert proc.stdin is not None
try:
    for n in range(FRAMES):
        proc.stdin.write(make_frame(n).tobytes())
finally:
    proc.stdin.close()
code = proc.wait()
if code != 0:
    raise SystemExit(code)

size_mb = OUT.stat().st_size / (1024 * 1024)
print(f"Generated {OUT} ({size_mb:.2f} MiB, 3840x2160, {SECONDS}s @ {FPS}fps)")
