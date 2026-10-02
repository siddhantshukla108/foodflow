import os
from PIL import Image, ImageDraw
import random

print("Generating a synthetic 500-image dataset for the Hackathon MVP...")
print("This allows us to train the model immediately without waiting for a 15GB download.")
print("You can replace these folders with real images later if needed.")

categories = {
    'Fresh': (0, 255, 0),    # Greenish
    'Rotten': (139, 69, 19)  # Brownish
}

base_dir = '../dataset/freshness'
os.makedirs(base_dir, exist_ok=True)

for cat, color in categories.items():
    cat_dir = os.path.join(base_dir, cat)
    os.makedirs(cat_dir, exist_ok=True)
    
    for i in range(250): # 250 per category = 500 total
        img = Image.new('RGB', (224, 224), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        
        # Add some random noise/shapes to make the model actually learn a pattern
        x = random.randint(20, 100)
        y = random.randint(20, 100)
        r = random.randint(50, 150)
        
        # Base color representing fresh vs rotten
        draw.ellipse([x, y, x+r, y+r], fill=color)
        
        # Add some spots for rotten
        if cat == 'Rotten':
            for _ in range(5):
                sx = random.randint(x, x+r)
                sy = random.randint(y, y+r)
                draw.ellipse([sx, sy, sx+10, sy+10], fill=(0, 0, 0))
                
        img.save(os.path.join(cat_dir, f"{cat}_{i}.jpg"))

print(f"Successfully generated 500 images in {base_dir}")
