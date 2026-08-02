from PIL import Image
from pathlib import Path
from collections import deque

theme = Path(r"c:\Users\kckar\OneDrive\Desktop\Shikshalab.com\frontend\site\public\images\theme")


def is_bg_pixel(r: int, g: int, b: int) -> bool:
    mx = max(r, g, b)
    mn = min(r, g, b)
    # almost white
    if r >= 245 and g >= 245 and b >= 245:
        return True
    # light gray / off-white (low saturation)
    if mx >= 225 and (mx - mn) <= 30:
        return True
    # soft light gray like 244,245,244
    if mx >= 235 and mn >= 230 and (mx - mn) <= 20:
        return True
    return False


def remove_light_bg(src: Path) -> None:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    px = img.load()

    def looks_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return False
        return is_bg_pixel(r, g, b)

    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if looks_bg(x, y):
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if looks_bg(x, y):
                q.append((x, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        if not looks_bg(x, y):
            continue
        visited[y][x] = True
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # clear thin white fringe next to transparent
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r < 248 or g < 248 or b < 248:
                continue
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                    px[x, y] = (0, 0, 0, 0)
                    break

    img.save(src, "PNG")
    corner = img.getpixel((2, 2))
    print(f"{src.name}: corner={corner} mode={img.mode}")


for name in ("testimonial-char-3d.png", "testimonial-squiggle-3d.png"):
    remove_light_bg(theme / name)

print("done")
