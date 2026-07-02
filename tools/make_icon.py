from PIL import Image, ImageDraw
import json, os
spec = json.load(open(os.path.join(os.path.dirname(__file__), 'wallaby.json'), encoding='utf-8'))
frame = spec['frames'][0]
cols = max(len(r) for r in frame); rows = len(frame)
W = H = 128; scale = 5
img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, W-1, H-1], radius=26, fill=(16, 163, 127, 255))  # OpenAI teal
gw, gh = cols*scale, rows*scale
ox, oy = (W-gw)//2, (H-gh)//2
for r, line in enumerate(frame):
    for c, ch in enumerate(line):
        if ch not in ('.', ' ', ''):
            x, y = ox+c*scale, oy+r*scale
            d.rectangle([x, y, x+scale-1, y+scale-1], fill=(255, 255, 255, 255))
out = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'icon.png')
img.save(out)
print('wrote', out, os.path.getsize(out), 'bytes')
