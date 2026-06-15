# Regenerate the PARACETAMOL test label for spike/validate-safety.ts (the abstain case).
# models/ is gitignored, so recreate the image locally:
#   pip install pillow   (or: sudo apt-get install -y python3-pil)
#   python3 spike/make-label-paracetamol.py
from PIL import Image, ImageDraw, ImageFont

img = Image.new("RGB", (640, 240), "white")
d = ImageDraw.Draw(img)
try:
    bold = ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 54
    )
    reg = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34)
except OSError:
    bold = reg = ImageFont.load_default()
d.text((40, 70), "PARACETAMOL", fill="black", font=bold)
d.text((40, 150), "500 mg tablets", fill="black", font=reg)
img.save("models/label-paracetamol.png")
print("wrote models/label-paracetamol.png")
