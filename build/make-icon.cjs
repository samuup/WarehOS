const sharp = require('sharp');
const png2icons = require('png2icons');
const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, 'logo.png');
const icoPath = path.join(__dirname, 'icon.ico');
const icnsPath = path.join(__dirname, 'icon.icns');
const png512Path = path.join(__dirname, 'icon.png');

// Sizes to embed in the ICO (Windows reads the best match). 256 => width byte 0.
const sizes = [16, 24, 32, 48, 64, 128, 256];

async function build() {
  const pngs = [];
  for (const s of sizes) {
    const png = await sharp(pngPath).resize(s, s).png().toBuffer();
    pngs.push({ size: s, data: png });
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4); // count

  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const p of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(p.size === 256 ? 0 : p.size, 0); // width
    e.writeUInt8(p.size === 256 ? 0 : p.size, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bit count
    e.writeUInt32LE(p.data.length, 8); // bytes in res
    e.writeUInt32LE(offset, 12); // image offset
    entries.push(e);
    offset += p.data.length;
  }

  const out = Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
  fs.writeFileSync(icoPath, out);
  console.log('ICO generado:', icoPath, '-', sizes.join(', '), 'px');

  // macOS: icon.icns (16/32/128/256/512) y Linux: icon.png (512px)
  const source = await sharp(pngPath).resize(512, 512).png().toBuffer();
  fs.writeFileSync(png512Path, source);
  console.log('PNG 512 generado:', png512Path);

  const icns = png2icons.createICNS(source, png2icons.LINEAR, 0);
  if (!icns) throw new Error('No se pudo generar el archivo .icns');
  fs.writeFileSync(icnsPath, icns);
  console.log('ICNS generado:', icnsPath);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
