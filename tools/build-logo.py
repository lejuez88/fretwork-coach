#!/usr/bin/env python3
"""Render the SONYX logo finish for each color scheme.

Takes Chris's artwork (img/sonyx-wordmark.png, img/sonyx-pick.png: white on transparent)
and paints the look from his branding sheet onto it: beveled glass letters with a bright
top edge, diagonal reflection streaks, color travelling from deep (left) to bright (right),
and thinner, slightly see-through outlines on the hollow lower half. Scheme 4 (Studio Mono)
uses the sheet's chrome treatment.

Output: img/logo/word-<scheme>.png and img/logo/pick-<scheme>.png at 2x.
Run after changing a scheme's accent in css/theme.css:  python3 tools/build-logo.py
Needs numpy, scipy and Pillow (pip install numpy scipy pillow).
"""
import colorsys, os
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Scheme accents (css/app.css :root and css/theme.css). Mono = chrome; 2 and 3 = the sheet's tones.
SCHEMES = {1: '#f5a524', 2: 'sheet-green', 3: 'sheet-blue', 4: None}
# Schemes 2 and 3 use the tones sampled from the branding sheet's Acid Green and Electric Blue logos.
SHEET = {
    'sheet-green': ('#1a4a0c', '#3fa81c', '#5fe032', '#8ef55b', '#d8ffc4'),
    'sheet-blue': ('#123552', '#1f5f8e', '#3f92c8', '#62b6e0', '#b4e3f8'),
}


def hx(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255


def palette(accent):
    """Tones from deep to highlight, shaped like the sheet's orange/blue/green variations."""
    if accent in SHEET:
        return [hx(c) for c in SHEET[accent]]
    if accent is None:  # chrome (the sheet's monochrome pick)
        return [np.array(c) / 255 for c in ((58, 60, 64), (128, 131, 136), (196, 199, 204), (236, 238, 241), (255, 255, 255))]
    r, g, b = hx(accent); h, l, s = colorsys.rgb_to_hls(r, g, b)
    def t(dh, L, S): return np.array(colorsys.hls_to_rgb((h + dh) % 1, L, min(1, S)))
    return [t(-.025, .20, s * .95), t(-.012, .36, s), t(0, max(.5, l * .95), s), t(.03, .66, s), t(.045, .86, s * .9)]


def ramp(tval, pal):
    """Map 0..1 onto the palette (piecewise linear)."""
    tval = np.clip(tval, 0, 1) * (len(pal) - 1)
    i = np.clip(np.floor(tval).astype(int), 0, len(pal) - 2); f = (tval - i)[..., None]
    P = np.stack(pal)
    return P[i] * (1 - f) + P[i + 1] * f


def render(art, pal, kind, scale=2):
    im = Image.open(os.path.join(ROOT, 'img', art)).convert('RGBA')
    im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
    A = np.asarray(im)[..., 3] / 255.0
    H, W = A.shape
    v, u = np.mgrid[0:H, 0:W]; u = u / W; v = v / H
    # solid areas (top half of the letters, top of the pick) vs thin outlines
    dens = gaussian_filter(A, 5 * scale)
    solid = np.clip((dens - .45) / .25, 0, 1)
    # lighting
    if kind == 'word':
        t = .22 + .44 * u                                          # deep left → bright right
        t += .26 * np.clip(1 - v / .5, 0, 1) ** 1.6 - .10          # brighter toward the top edge
        t += .10 * np.cos(2 * np.pi * (2.3 * u + 1.2 * v))         # diagonal reflection streaks
        t += .06 * np.cos(2 * np.pi * (7.0 * u + 3.0 * v) + 1.1)
    else:
        t = .38 + .22 * u + .25 * np.clip(1 - v / .55, 0, 1) ** 1.4
        t += .42 * np.exp(-((u * .95 - v * .55 - .30) / .07) ** 2)  # chrome specular band
        t += .14 * np.exp(-((u * .95 - v * .55 - .52) / .05) ** 2)
    # bevel: light from above on the solid parts
    Ab = gaussian_filter(A, .9 * scale)
    gy = np.zeros_like(Ab); gy[1:-1] = Ab[:-2] - Ab[2:]
    t = t + solid * (1.1 * np.clip(-gy, 0, None) * scale * 2 - .9 * np.clip(gy, 0, None) * scale * 2)
    # outlines: a slightly lighter, flatter tone
    t_out = .30 + .30 * u
    tt = solid * t + (1 - solid) * t_out
    rgb = ramp(tt, pal)
    # thin darker rim on solid edges for crispness
    rim = np.clip(A - gaussian_filter(A, .8 * scale), 0, 1)
    rgb = rgb * (1 - .55 * (rim * solid)[..., None])
    alpha = A * (solid + (1 - solid) * .72)
    out = np.dstack([np.clip(rgb, 0, 1) * 255, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'img', 'logo'), exist_ok=True)
    for n, acc in SCHEMES.items():
        pal = palette(acc)
        render('sonyx-wordmark.png', pal, 'word').save(os.path.join(ROOT, 'img', 'logo', f'word-{n}.png'), optimize=True)
        render('sonyx-pick.png', pal, 'pick').save(os.path.join(ROOT, 'img', 'logo', f'pick-{n}.png'), optimize=True)
        print('scheme', n, 'done')
