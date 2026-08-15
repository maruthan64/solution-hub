import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SolutionPackagesPage from "./page";
import type { SolutionPackage } from "@/lib/types";
import type { CurrentUser } from "@/lib/api";

const { getSolutionPackages, getCurrentUser } = vi.hoisted(() => ({
  getSolutionPackages: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getSolutionPackages,
    getCurrentUser,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function makePackage(overrides: Partial<SolutionPackage> = {}): SolutionPackage {
  return {
    id: "sol-1",
    name: "SAP on AWS Migration",
    cloud: "AWS",
    tagline: "Move SAP off legacy hardware.",
    outcome: "Customers avoid a hardware refresh.",
    assumptions: [],
    services: [],
    referenceArchitecture: "",
    pricingNote: "",
    ...overrides,
  };
}

const PACKAGES: SolutionPackage[] = [
  makePackage({ id: "sol-1", name: "SAP on AWS Migration", tagline: "Move SAP off legacy hardware." }),
  makePackage({ id: "sol-2", name: "Contact Center Modernization", tagline: "Move off legacy PBX systems." }),
];

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

describe("SolutionPackagesPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hides Add and Edit actions for a role without edit rights", async () => {
    getSolutionPackages.mockResolvedValue(PACKAGES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Sales" }));

    render(<SolutionPackagesPage />);

    await waitFor(() => expect(screen.getByText("SAP on AWS Migration")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /add solution package/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("shows Add and Edit actions for Owner", async () => {
    getSolutionPackages.mockResolvedValue(PACKAGES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));

    render(<SolutionPackagesPage />);

    await waitFor(() => expect(screen.getByText("SAP on AWS Migration")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /add solution package/i })).toBeInTheDocument();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
  });

  it("filters packages as the user types in search", async () => {
    getSolutionPackages.mockResolvedValue(PACKAGES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    const user = userEvent.setup();

    render(<SolutionPackagesPage />);

    await waitFor(() => expect(screen.getByText("Contact Center Modernization")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search solution packages/i), "sap");

    expect(screen.getByText("SAP on AWS Migration")).toBeInTheDocument();
    expect(screen.queryByText("Contact Center Modernization")).not.toBeInTheDocument();
  });

  it("shows a no-matches message when the search has no hits", async () => {
    getSolutionPackages.mockResolvedValue(PACKAGES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    const user = userEvent.setup();

    render(<SolutionPackagesPage />);

    await waitFor(() => expect(screen.getByText("SAP on AWS Migration")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search solution packages/i), "zzznomatch");

    expect(await screen.findByText(/no solution packages match/i)).toBeInTheDocument();
  });
});
