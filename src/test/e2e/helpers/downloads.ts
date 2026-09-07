import type { ElectronApplication } from 'playwright';

/**
 * Hace que las descargas del proceso main (exportaciones CSV/PDF disparadas
 * con un <a download>) se guarden en `dir` en lugar de cancelarse en silencio
 * por falta de un manejador will-download. Registrar UNA vez por spec.
 */
export async function saveDownloadsTo(app: ElectronApplication, dir: string): Promise<void> {
  await app.evaluate(({ session }, root) => {
    session.defaultSession.on(
      'will-download',
      (_event: unknown, item: { setSavePath: (p: string) => void; getFilename: () => string }) => {
        item.setSavePath(`${root}/${item.getFilename()}`);
      },
    );
  }, dir);
}