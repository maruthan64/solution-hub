import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ServiceCatalogPage from "./page";
import type { ServicePackage } from "@/lib/types";
import type { CurrentUser } from "@/lib/api";

const { getServiceCatalog, getCurrentUser, getProjects } = vi.hoisted(() => ({
  getServiceCatalog: vi.fn(),
  getCurrentUser: vi.fn(),
  getProjects: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getServiceCatalog,
    getCurrentUser,
    getProjects,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function makePackage(overrides: Partial<ServicePackage> = {}): ServicePackage {
  return {
    id: "pkg-1",
    category: "tier",
    name: "Basic Tier",
    tagline: "Small workloads, just getting started.",
    monthlyPrice: "$500/mo",
    resources: [{ service: "EC2 t3.medium", quantity: 2, purpose: "App servers" }],
    ...overrides,
  };
}

const PACKAGES: ServicePackage[] = [
  makePackage({ id: "pkg-1", category: "tier", name: "Basic Tier", tagline: "Small workloads, just getting started." }),
  makePackage({ id: "pkg-2", category: "container", name: "EKS Add-On", tagline: "Managed Kubernetes." }),
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

describe("ServiceCatalogPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hides New Package and Edit actions for a role without edit rights", async () => {
    getServiceCatalog.mockResolvedValue(PACKAGES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Sales" }));
    getProjects.mockResolvedValue([]);

    render(<ServiceCatalogPage />);

    await waitFor(() => expect(screen.getByText("Basic Tier")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /new package/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("shows New Package and Edit actions for Owner", async () => {
    getServiceCatalog.mockResolvedValue(PACKAGES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    getProjects.mockResolvedValue([]);

    render(<ServiceCatalogPage />);

    await waitFor(() => expect(screen.getByText("Basic Tier")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /new package/i })).toBeInTheDocument();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
  });

  it("filters packages as the user types in search", async () => {
    getServiceCatalog.mockResolvedValue(PACKAGES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    getProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<ServiceCatalogPage />);

    await waitFor(() => expect(screen.getByText("EKS Add-On")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search packages/i), "kubernetes");

    expect(screen.getByText("EKS Add-On")).toBeInTheDocument();
    expect(screen.queryByText("Basic Tier")).not.toBeInTheDocument();
  });

  it("shows a no-matches message when the search has no hits", async () => {
    getServiceCatalog.mockResolvedValue(PACKAGES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    getProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<ServiceCatalogPage />);

    await waitFor(() => expect(screen.getByText("Basic Tier")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search packages/i), "zzznomatch");

    expect(await screen.findByText(/no packages match/i)).toBeInTheDocument();
  });
});
