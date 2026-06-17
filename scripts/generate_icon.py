#!/usr/bin/env python3
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


SIZE = 1024
SCALE = 2
W = SIZE * SCALE
H = SIZE * SCALE


def clamp(value: int) -> int:
    return max(0, min(255, value))


def mix(a: tuple[int, int, int, int], b: tuple[int, int, int, int], t: float):
    return tuple(clamp(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


def set_px(buf: bytearray, x: int, y: int, color: tuple[int, int, int, int]):
    if x < 0 or y < 0 or x >= W or y >= H:
        return
    idx = (y * W + x) * 4
    src_a = color[3] / 255
    if src_a >= 0.999:
        buf[idx : idx + 4] = bytes(color)
        return
    dst_a = buf[idx + 3] / 255
    out_a = src_a + dst_a * (1 - src_a)
    if out_a <= 0:
        return
    for i in range(3):
        src = color[i] / 255
        dst = buf[idx + i] / 255
        out = (src * src_a + dst * dst_a * (1 - src_a)) / out_a
        buf[idx + i] = clamp(round(out * 255))
    buf[idx + 3] = clamp(round(out_a * 255))


def rounded_rect_contains(px: float, py: float, x: float, y: float, w: float, h: float, r: float):
    cx = min(max(px, x + r), x + w - r)
    cy = min(max(py, y + r), y + h - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def fill_rounded_rect(
    buf: bytearray,
    x: int,
    y: int,
    w: int,
    h: int,
    r: int,
    color: tuple[int, int, int, int],
):
    for yy in range(max(0, y), min(H, y + h)):
        for xx in range(max(0, x), min(W, x + w)):
            if rounded_rect_contains(xx + 0.5, yy + 0.5, x, y, w, h, r):
                set_px(buf, xx, yy, color)


def fill_circle(
    buf: bytearray,
    cx: int,
    cy: int,
    radius: int,
    color: tuple[int, int, int, int],
):
    r2 = radius * radius
    for yy in range(max(0, cy - radius), min(H, cy + radius + 1)):
        dy = yy + 0.5 - cy
        for xx in range(max(0, cx - radius), min(W, cx + radius + 1)):
            dx = xx + 0.5 - cx
            if dx * dx + dy * dy <= r2:
                set_px(buf, xx, yy, color)


def fill_polygon(
    buf: bytearray,
    points: list[tuple[int, int]],
    color: tuple[int, int, int, int],
):
    min_y = max(0, min(y for _, y in points))
    max_y = min(H - 1, max(y for _, y in points))
    for yy in range(min_y, max_y + 1):
        hits: list[float] = []
        for i, (x1, y1) in enumerate(points):
            x2, y2 = points[(i + 1) % len(points)]
            if (y1 <= yy < y2) or (y2 <= yy < y1):
                t = (yy - y1) / (y2 - y1)
                hits.append(x1 + (x2 - x1) * t)
        hits.sort()
        for i in range(0, len(hits), 2):
            if i + 1 >= len(hits):
                break
            start = max(0, math.ceil(hits[i]))
            end = min(W - 1, math.floor(hits[i + 1]))
            for xx in range(start, end + 1):
                set_px(buf, xx, yy, color)


def draw_capsule_line(
    buf: bytearray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    radius: int,
    color: tuple[int, int, int, int],
):
    min_x = max(0, min(x1, x2) - radius)
    max_x = min(W - 1, max(x1, x2) + radius)
    min_y = max(0, min(y1, y2) - radius)
    max_y = min(H - 1, max(y1, y2) + radius)
    vx = x2 - x1
    vy = y2 - y1
    length2 = vx * vx + vy * vy
    for yy in range(min_y, max_y + 1):
        for xx in range(min_x, max_x + 1):
            if length2 == 0:
                dist2 = (xx - x1) ** 2 + (yy - y1) ** 2
            else:
                t = max(0, min(1, ((xx - x1) * vx + (yy - y1) * vy) / length2))
                px = x1 + t * vx
                py = y1 + t * vy
                dist2 = (xx - px) ** 2 + (yy - py) ** 2
            if dist2 <= radius * radius:
                set_px(buf, xx, yy, color)


def write_png(path: Path, rgba: bytes, width: int, height: int):
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])

    def chunk(kind: bytes, data: bytes):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def downsample(buf: bytearray):
    out = bytearray(SIZE * SIZE * 4)
    for y in range(SIZE):
        for x in range(SIZE):
            acc = [0, 0, 0, 0]
            for yy in range(SCALE):
                for xx in range(SCALE):
                    idx = ((y * SCALE + yy) * W + x * SCALE + xx) * 4
                    for i in range(4):
                        acc[i] += buf[idx + i]
            dst = (y * SIZE + x) * 4
            count = SCALE * SCALE
            for i in range(4):
                out[dst + i] = acc[i] // count
    return bytes(out)


def s(value: int) -> int:
    return value * SCALE


def main():
    buf = bytearray(W * H * 4)

    # Drop shadow.
    for offset, alpha in [(30, 32), (18, 42), (8, 48)]:
        fill_rounded_rect(
            buf,
            s(88 + offset // 3),
            s(104 + offset),
            s(848),
            s(820),
            s(190),
            (13, 31, 76, alpha),
        )

    # Rounded-square app background with diagonal business-blue to teal gradient.
    x0, y0, bw, bh, br = s(88), s(82), s(848), s(848), s(196)
    c1 = (13, 70, 186, 255)
    c2 = (6, 176, 159, 255)
    c3 = (18, 34, 88, 255)
    for yy in range(y0, y0 + bh):
        for xx in range(x0, x0 + bw):
            if not rounded_rect_contains(xx + 0.5, yy + 0.5, x0, y0, bw, bh, br):
                continue
            tx = (xx - x0) / bw
            ty = (yy - y0) / bh
            base = mix(c1, c2, max(0, min(1, 0.72 * tx + 0.35 * ty)))
            vignette = ((tx - 0.5) ** 2 + (ty - 0.52) ** 2) ** 0.5
            color = mix(base, c3, max(0, min(0.3, vignette * 0.36)))
            set_px(buf, xx, yy, color)

    # Background highlight and local-database ledger strokes.
    fill_circle(buf, s(300), s(250), s(230), (99, 218, 255, 38))
    fill_circle(buf, s(770), s(780), s(280), (29, 255, 191, 30))
    for y in [682, 738, 794]:
        fill_rounded_rect(buf, s(596), s(y), s(230), s(34), s(17), (218, 248, 255, 44))
        fill_rounded_rect(buf, s(558), s(y + 7), s(68), s(20), s(10), (255, 255, 255, 52))

    # Document shadow and body.
    fill_rounded_rect(buf, s(256), s(238), s(468), s(562), s(54), (6, 25, 82, 72))
    fill_rounded_rect(buf, s(238), s(216), s(468), s(562), s(54), (242, 249, 255, 255))
    fill_rounded_rect(buf, s(270), s(282), s(270), s(28), s(14), (23, 84, 184, 70))
    fill_rounded_rect(buf, s(270), s(350), s(350), s(24), s(12), (18, 65, 145, 42))
    fill_rounded_rect(buf, s(270), s(404), s(320), s(24), s(12), (18, 65, 145, 35))
    fill_rounded_rect(buf, s(270), s(458), s(250), s(24), s(12), (18, 65, 145, 30))

    # Folded document corner.
    fill_polygon(
        buf,
        [(s(588), s(216)), (s(706), s(334)), (s(588), s(334))],
        (213, 232, 251, 255),
    )
    draw_capsule_line(buf, s(588), s(335), s(706), s(335), s(2), (177, 209, 239, 255))
    draw_capsule_line(buf, s(588), s(216), s(706), s(334), s(2), (255, 255, 255, 190))

    # Check seal.
    fill_circle(buf, s(610), s(590), s(154), (9, 111, 211, 210))
    fill_circle(buf, s(610), s(590), s(128), (11, 192, 165, 255))
    fill_circle(buf, s(610), s(590), s(104), (16, 207, 179, 255))
    draw_capsule_line(buf, s(542), s(592), s(592), s(646), s(18), (255, 255, 255, 255))
    draw_capsule_line(buf, s(590), s(646), s(696), s(528), s(18), (255, 255, 255, 255))

    # Gold payment coin.
    fill_circle(buf, s(356), s(695), s(92), (126, 81, 8, 60))
    fill_circle(buf, s(344), s(680), s(88), (243, 171, 48, 255))
    fill_circle(buf, s(344), s(680), s(64), (255, 215, 92, 255))
    draw_capsule_line(buf, s(312), s(678), s(376), s(678), s(10), (181, 119, 18, 180))
    draw_capsule_line(buf, s(344), s(648), s(344), s(712), s(10), (181, 119, 18, 180))

    # Top-left shine and subtle foreground rim.
    fill_rounded_rect(buf, s(124), s(116), s(776), s(108), s(54), (255, 255, 255, 28))
    draw_capsule_line(buf, s(198), s(898), s(822), s(898), s(5), (255, 255, 255, 42))

    # Keep the final app icon silhouette clean and standard.
    for yy in range(H):
        for xx in range(W):
            if not rounded_rect_contains(xx + 0.5, yy + 0.5, x0, y0, bw, bh, br):
                idx = (yy * W + xx) * 4
                buf[idx : idx + 4] = b"\x00\x00\x00\x00"

    rgba = downsample(buf)
    out = Path("src-tauri/icons/icon.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    write_png(out, rgba, SIZE, SIZE)
    print(out)


if __name__ == "__main__":
    main()
