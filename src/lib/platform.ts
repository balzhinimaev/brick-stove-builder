/**
 * Запущены ли мы внутри нативной оболочки Capacitor (Android-приложение).
 * Через window, а не import из @capacitor/core: веб-бандл не должен зависеть
 * от нативного рантайма, а в WebView мост инжектируется до загрузки скриптов.
 * Результат фиксируется при первом вызове: платформа не меняется на лету,
 * а @capacitor/core при ленивой загрузке пересоздаёт window.Capacitor.
 */
let cached: boolean | null = null;

export function isNativeApp(): boolean {
  if (cached === null) {
    const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    cached = Boolean(capacitor?.isNativePlatform?.());
  }
  return cached;
}
