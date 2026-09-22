import { writeFileSync } from "fs";
import { PNG } from "pngjs";

// Create a 128x128 gradient circle PNG
const png = new PNG({ width: 128, height: 128 });
const cx = 64, cy = 64, r = 58;
for (let y = 0; y < 128; y++) {
  for (let x = 0; x < 128; x++) {
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const idx = (y * 128 + x) * 4;
    if (dist <= r) {
      // Purple gradient circle
      const t = dist / r;
      png.data[idx] = Math.round(98 + t * 70);     // R
      png.data[idx + 1] = Math.round(80 + t * 60); // G
      png.data[idx + 2] = Math.round(200 - t * 40);// B
      png.data[idx + 3] = 255;                      // A
    } else {
      png.data[idx] = 0; png.data[idx + 1] = 0;
      png.data[idx + 2] = 0; png.data[idx + 3] = 0; // Transparent
    }
  }
}

writeFileSync("src-tauri/icons/app-icon.png", PNG.sync.write(png));
console.log("Source PNG created");
