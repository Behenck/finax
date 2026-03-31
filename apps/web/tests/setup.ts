import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

if (typeof globalThis.ResizeObserver === "undefined") {
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	}

	globalThis.ResizeObserver =
		ResizeObserverMock as unknown as typeof ResizeObserver;
}

afterEach(() => {
	cleanup();
});
