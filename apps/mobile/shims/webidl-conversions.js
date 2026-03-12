function defineBooleanGetter(target, propertyName, value) {
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
      get() {
        return value;
      },
    });
  } catch {
    // best effort shim for runtimes that lock prototypes
  }
}

function toWellFormedFallback(value) {
  const str = String(value);
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
}

function domStringFallback(value, options = {}) {
  if (options.treatNullAsEmptyString && value === null) {
    return "";
  }

  if (typeof value === "symbol") {
    throw new TypeError("Cannot convert a Symbol value to a string");
  }

  const StringCtor = options.globals?.String ?? String;
  return StringCtor(value);
}

const arrayBufferProto = globalThis.ArrayBuffer?.prototype;
defineBooleanGetter(arrayBufferProto, "resizable", false);

if (typeof globalThis.SharedArrayBuffer === "undefined") {
  globalThis.SharedArrayBuffer = globalThis.ArrayBuffer;
}

const sharedArrayBufferProto = globalThis.SharedArrayBuffer?.prototype;
defineBooleanGetter(sharedArrayBufferProto, "growable", false);
defineBooleanGetter(sharedArrayBufferProto, "resizable", false);

const conversions = require("../../../node_modules/webidl-conversions/lib/index.js");

if (!conversions || typeof conversions !== "object") {
  module.exports = {
    DOMString: domStringFallback,
    USVString: (value, options = {}) => toWellFormedFallback(domStringFallback(value, options)),
  };
} else {
  if (typeof conversions.DOMString !== "function") {
    conversions.DOMString = domStringFallback;
  }

  conversions.USVString = (value, options = {}) => {
    const domStringValue = conversions.DOMString(value, options);

    if (domStringValue && typeof domStringValue.toWellFormed === "function") {
      return domStringValue.toWellFormed();
    }

    return toWellFormedFallback(domStringValue);
  };

  module.exports = conversions;
}
