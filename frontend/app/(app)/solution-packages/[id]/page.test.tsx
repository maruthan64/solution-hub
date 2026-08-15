import { Suspense, act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SolutionPackageDetailPage from "./page";
import type { SolutionPackage } from "@/lib/types";
import type { CurrentUser } from "@/lib/api";

const { getSolutionPackage, getCurrentUser, updateSolutionPackage, deleteSolutionPackage } = vi.hoisted(() => ({
  getSolutionPackage: vi.fn(),
  getCurrentUser: vi.fn(),
  updateSolutionPackage: vi.fn(),
  deleteSolutionPackage: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getSolutionPackage,
    getCurrentUser,
    updateSolutionPackage,
    deleteSolutionPackage,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const PACKAGE: SolutionPackage = {
  id: "sol-1",
  name: "SAP on AWS Migration",
  cloud: "AWS",
  tagline: "Move SAP off legacy hardware.",
  outcome: "Customers avoid a hardware refresh.",
  assumptions: ["Customer has an existing AWS account."],
  services: [{ service: "EC2", purpose: "SAP application tier" }],
  referenceArchitecture: "HANA on X2iedn, Multi-AZ.",
  pricingNote: "Starting at $25,000.",
};

function mockUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "u-1",
    name: "Test User",
    username: "test",
    email: "test@example.com",
    role: "Viewer",
    mustChangePassword: false,
    allowedModules: [],
    ...overrides,
  };
}

// The page reads `params` via React's `use()`, which suspends synchronously on
// mount — the initial render has to be wrapped in an awaited `act()` so React
// actually flushes the retry once the promise resolves (RTL's own internal
// act() wrapping around a plain `render()` call closes too early for this).
async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback="loading">
        <SolutionPackageDetailPage params={Promise.resolve({ id: "sol-1" })} />
      </Suspense>,
    );
  });
}

describe("SolutionPackageDetailPage", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/solution-packages/sol-1");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a read-only view by default, with no editable fields", async () => {
    getSolutionPackage.mockResolvedValue(PACKAGE);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));

    await renderPage();

    await waitFor(() => expect(screen.getByText("Move SAP off legacy hardware.")).toBeInTheDocument());

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("does not show an Edit button for a role without edit rights", async () => {
    getSolutionPackage.mockResolvedValue(PACKAGE);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Sales" }));

    await renderPage();

    await waitFor(() => expect(screen.getByText("Move SAP off legacy hardware.")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("switches into an editable form when Edit is clicked", async () => {
    getSolutionPackage.mockResolvedValue(PACKAGE);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    const user = userEvent.setup();

    await renderPage();

    await waitFor(() => expect(screen.getByText("Move SAP off legacy hardware.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByDisplayValue("SAP on AWS Migration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    // The per-row "remove" buttons in the Assumptions/Services lists are also
    // icon-only Delete buttons, so more than the header one is expected here.
    expect(screen.getAllByRole("button", { name: /delete/i }).length).toBeGreaterThan(0);
  });

  it("does not enter edit mode via ?edit=1 for a role without edit rights", async () => {
    window.history.pushState({}, "", "/solution-packages/sol-1?edit=1");
    getSolutionPackage.mockResolvedValue(PACKAGE);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Sales" }));

    await renderPage();

    await waitFor(() => expect(screen.getByText("Move SAP off legacy hardware.")).toBeInTheDocument());

    // The read-only view renders plain text, not form fields — and no Save/Delete
    // buttons should be reachable regardless of the URL param.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("does enter edit mode via ?edit=1 for an editor", async () => {
    window.history.pushState({}, "", "/solution-packages/sol-1?edit=1");
    getSolutionPackage.mockResolvedValue(PACKAGE);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Architect" }));

    await renderPage();

    await waitFor(() => expect(screen.getByDisplayValue("SAP on AWS Migration")).toBeInTheDocument());
  });
});
