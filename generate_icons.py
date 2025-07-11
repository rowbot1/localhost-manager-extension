from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # Create new image with blue background
    img = Image.new('RGB', (size, size), color='#2563eb')
    draw = ImageDraw.Draw(img)
    
    # Draw server stack (3 white bars)
    bar_height = size // 8
    bar_width = int(size * 0.6)
    start_x = (size - bar_width) // 2
    gap = size // 16
    
    for i in range(3):
        y = int(size * 0.25 + i * (bar_height + gap))
        # White bar
        draw.rectangle([start_x, y, start_x + bar_width, y + bar_height], fill='white')
        # Blue dot on right side (port indicator)
        dot_center_x = start_x + bar_width - bar_height // 2
        dot_center_y = y + bar_height // 2
        dot_radius = bar_height // 4
        draw.ellipse([dot_center_x - dot_radius, dot_center_y - dot_radius,
                      dot_center_x + dot_radius, dot_center_y + dot_radius], fill='#2563eb')
    
    # Add port text for larger icons
    if size >= 48:
        try:
            font_size = size // 4
            # Try to use a basic font, fallback to default if not available
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            font = ImageFont.load_default()
        
        text = ":80"
        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_x = (size - text_width) // 2
        text_y = int(size * 0.75)
        draw.text((text_x, text_y), text, fill='white', font=font)
    
    return img

# Generate all icon sizes
sizes = [16, 48, 128]
for size in sizes:
    icon = create_icon(size)
    icon.save(f'icons/icon-{size}.png')
    print(f"Generated icon-{size}.png")

print("All icons generated successfully!")