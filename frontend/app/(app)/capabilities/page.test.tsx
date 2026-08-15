import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CapabilitiesPage from "./page";
import type { Capability } from "@/lib/types";
import type { CurrentUser } from "@/lib/api";

const { getCapabilities, getCurrentUser, getProjects } = vi.hoisted(() => ({
  getCapabilities: vi.fn(),
  getCurrentUser: vi.fn(),
  getProjects: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getCapabilities,
    getCurrentUser,
    getProjects,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function makeCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: "cap-1",
    name: "AWS Contact Center",
    cloud: "AWS",
    description: "Omnichannel contact center on Amazon Connect.",
    keyServices: ["Amazon Connect", "Amazon Lex"],
    status: "Active",
    githubUrl: null,
    certifications: [],
    caseStudies: [],
    ...overrides,
  };
}

const CAPABILITIES: Capability[] = [
  makeCapability({ id: "cap-1", name: "AWS Contact Center", description: "Omnichannel routing and IVR." }),
  makeCapability({ id: "cap-2", name: "Kubernetes Platforms", cloud: "Multi-Cloud", description: "Managed EKS clusters." }),
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

describe("CapabilitiesPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hides Add/Edit/Delete actions for a role without edit rights", async () => {
    getCapabilities.mockResolvedValue(CAPABILITIES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Sales" }));
    getProjects.mockResolvedValue([]);

    render(<CapabilitiesPage />);

    await waitFor(() => expect(screen.getByText("AWS Contact Center")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /add capability/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("shows Add/Edit/Delete actions for Owner", async () => {
    getCapabilities.mockResolvedValue(CAPABILITIES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    getProjects.mockResolvedValue([]);

    render(<CapabilitiesPage />);

    await waitFor(() => expect(screen.getByText("AWS Contact Center")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: /add capability/i })).toBeInTheDocument();
    expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delete").length).toBeGreaterThan(0);
  });

  it("filters the list down as the user types in search", async () => {
    getCapabilities.mockResolvedValue(CAPABILITIES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    getProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<CapabilitiesPage />);

    await waitFor(() => expect(screen.getByText("Kubernetes Platforms")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search capabilities/i), "contact");

    expect(screen.getByText("AWS Contact Center")).toBeInTheDocument();
    expect(screen.queryByText("Kubernetes Platforms")).not.toBeInTheDocument();
  });

  it("shows a no-matches message when the search has no hits", async () => {
    getCapabilities.mockResolvedValue(CAPABILITIES);
    getCurrentUser.mockResolvedValue(mockUser({ role: "Owner" }));
    getProjects.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<CapabilitiesPage />);

    await waitFor(() => expect(screen.getByText("AWS Contact Center")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search capabilities/i), "zzznomatch");

    expect(await screen.findByText(/no capabilities match/i)).toBeInTheDocument();
  });
});
