// Polyfills for browser-only globals that some dependencies (e.g. "jose")
// reference but that Hermes does not implement natively on React Native.
// Must be imported before anything that might trigger these references.

if (typeof (global as any).DOMException === "undefined") {
  class DOMExceptionPolyfill extends Error {
    code: number;
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || "Error";
      this.code = 0;
    }
  }
  (global as any).DOMException = DOMExceptionPolyfill;
}
