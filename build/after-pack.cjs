const path = require('path');
const fs = require('fs');
const { rcedit } = require('rcedit');

exports.default = async function afterPack(context) {
  const { appOutDir } = context;
  const productName = context.packager.appInfo.productName || 'WarehOS';
  const version = context.packager.appInfo.version || '0.1.0';

  const exePath = path.join(appOutDir, `${productName}.exe`);
  const iconPath = path.join(__dirname, 'icon.ico');

  if (!fs.existsSync(exePath)) {
    console.log(`[afterPack] No se encontró ${exePath}; se omite edición del icono.`);
    return;
  }

  if (!fs.existsSync(iconPath)) {
    console.log(`[afterPack] No se encontró ${iconPath}; se omite edición del icono.`);
    return;
  }

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      ProductName: productName,
      FileDescription: productName,
      CompanyName: '',
      InternalFilename: `${productName}.exe`,
      OriginalFilename: `${productName}.exe`,
      LegalCopyright: `Copyright © ${new Date().getFullYear()} ${productName}`,
    },
    'product-version': version,
    'file-version': version,
  });

  console.log(`[afterPack] Icono y metadatos incrustados en ${exePath}`);
};
