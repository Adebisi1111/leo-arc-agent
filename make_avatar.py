from PIL import Image, ImageDraw

S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

c1 = (46, 187, 238)
c2 = (5, 22, 30)
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S)
        d.point((x, y), lerp(c1, c2, t))

mask = Image.new("L", (S, S), 0)
md = ImageDraw.Draw(mask)
md.rectangle([32, 32, S - 33, S - 33], fill=255)
md.ellipse([32, 32, 32 + 208, 32 + 208], fill=0)
md.ellipse([S - 33 - 208, 32, S - 33, 32 + 208], fill=0)
md.ellipse([32, S - 33 - 208, 32 + 208, S - 33], fill=0)
md.ellipse([S - 33 - 208, S - 33 - 208, S - 33, S - 33], fill=0)
img.putalpha(mask)

d = ImageDraw.Draw(img)
edges = [(176,200,300,150),(300,150,372,232),(176,200,236,318),(236,318,372,232),
         (300,150,240,300),(240,300,360,356),(372,232,360,356),(236,318,360,356)]
for (x1,y1,x2,y2) in edges:
    d.line([(x1,y1),(x2,y2)], fill=(207,239,255,140), width=6)

for (x,y) in [(176,200),(300,150),(372,232),(236,318),(360,356)]:
    d.ellipse([x-22,y-22,x+22,y+22], fill=(234,246,255,255))

for r in (60, 45):
    d.ellipse([240-r,300-r,240+r,300+r], fill=(125,240,255,40 if r==60 else 70))
d.ellipse([240-34,300-34,240+34,300+34], fill=(255,255,255,255))
d.ellipse([240-34,300-34,240+34,300+34], outline=(46,187,238,255), width=4)
d.ellipse([240-16,300-16,240+16,300+16], outline=(5,22,30,255), width=6)
d.line([252,312,266,326], fill=(5,22,30,255), width=6)

img.save("C:/Users/Administrator/arc-autopay/topicgap-avatar.png")
print("PNG written", img.size)
