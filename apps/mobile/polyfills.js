(function installRuntimePolyfills() {
  const g = globalThis;

  function installWellFormedStringPolyfills() {
    const stringProto = g.String?.prototype;
    if (!stringProto) {
      return;
    }

    if (typeof stringProto.isWellFormed !== "function") {
      try {
        Object.defineProperty(stringProto, "isWellFormed", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: function isWellFormedPolyfill() {
            const str = String(this);

            for (let i = 0; i < str.length; i += 1) {
              const code = str.charCodeAt(i);

              if (code >= 0xd800 && code <= 0xdbff) {
                const next = str.charCodeAt(i + 1);
                if (!(next >= 0xdc00 && next <= 0xdfff)) {
                  return false;
                }
                i += 1;
                continue;
              }

              if (code >= 0xdc00 && code <= 0xdfff) {
                return false;
              }
            }

            return true;
          },
        });
      } catch {
        // no-op
      }
    }

    if (typeof stringProto.toWellFormed !== "function") {
      try {
        Object.defineProperty(stringProto, "toWellFormed", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: function toWellFormedPolyfill() {
            const str = String(this);
            let result = "";

            for (let i = 0; i < str.length; i += 1) {
              const code = str.charCodeAt(i);

              if (code >= 0xd800 && code <= 0xdbff) {
                const next = str.charCodeAt(i + 1);
                if (next >= 0xdc00 && next <= 0xdfff) {
                  result += str[i] + str[i + 1];
                  i += 1;
                } else {
                  result += "\ufffd";
                }
                continue;
              }

              if (code >= 0xdc00 && code <= 0xdfff) {
                result += "\ufffd";
                continue;
              }

              result += str[i];
            }

            return result;
          },
        });
      } catch {
        // no-op
      }
    }
  }

  installWellFormedStringPolyfills();

  if (typeof g.SharedArrayBuffer === "undefined") {
    g.SharedArrayBuffer = g.ArrayBuffer;
  }

  function defineSafeGetter(target, propertyName, getter) {
    if (!target) {
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(target, propertyName);
    if (descriptor && typeof descriptor.get === "function") {
      return;
    }

    try {
      Object.defineProperty(target, propertyName, {
        configurable: true,
        enumerable: false,
        get: getter,
      });
    } catch {
      // no-op: some runtimes lock these built-ins
    }
  }

  const arrayBufferProto = g.ArrayBuffer?.prototype;
  defineSafeGetter(arrayBufferProto, "byteLength", function byteLengthFallback() {
    try {
      return new Uint8Array(this).length;
    } catch {
      return 0;
    }
  });
  defineSafeGetter(arrayBufferProto, "resizable", function resizableFallback() {
    return false;
  });
  defineSafeGetter(arrayBufferProto, "maxByteLength", function maxByteLengthFallback() {
    try {
      return new Uint8Array(this).length;
    } catch {
      return 0;
    }
  });

  const sharedArrayBufferProto = g.SharedArrayBuffer?.prototype;
  defineSafeGetter(sharedArrayBufferProto, "byteLength", function byteLengthFallback() {
    try {
      return new Uint8Array(this).length;
    } catch {
      return 0;
    }
  });
  defineSafeGetter(sharedArrayBufferProto, "growable", function growableFallback() {
    return false;
  });
  defineSafeGetter(sharedArrayBufferProto, "resizable", function resizableFallback() {
    return false;
  });
})();
