import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// React's act() only flushes async work (including Suspense retries after a
// promise used with `use()` resolves) when it believes it's running inside a
// recognized test environment. RTL auto-detects Jest for this; Vitest needs
// the flag set explicitly or those retries silently never flush.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom doesn't implement matchMedia, but antd's Grid (Row/Col) breakpoint
// hook calls it on mount.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
});
