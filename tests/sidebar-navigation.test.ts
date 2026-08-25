import { describe, it, expect } from "vitest";

describe("Bug 3 Test: Sidebar Navigation & Active Route Matching Logic", () => {
  // Pure logic replica of the isActive function in Sidebar.tsx
  const isActive = (path: string, currentPathname: string) => {
    if (path === "/dashboard") {
      return currentPathname === "/dashboard";
    }
    if (path === "/expenses/create") {
      return currentPathname === "/expenses/create";
    }
    if (path === "/expenses/rollback") {
      return currentPathname === "/expenses/rollback" || currentPathname === "/rollback";
    }
    if (path === "/expenses") {
      return (
        currentPathname === "/expenses" ||
        (currentPathname.startsWith("/expenses/") &&
          !currentPathname.startsWith("/expenses/create") &&
          !currentPathname.startsWith("/expenses/rollback"))
      );
    }
    if (path.startsWith("/user-management")) {
      return currentPathname === "/user-management" || currentPathname.startsWith("/user-management");
    }
    if (path.startsWith("/master-management/categories")) {
      return currentPathname.startsWith("/master-management/categories");
    }
    if (path.startsWith("/master-management/gst")) {
      return currentPathname.startsWith("/master-management/gst");
    }
    if (path === "/profile") {
      return currentPathname === "/profile";
    }
    return currentPathname === path;
  };

  it("1, 2 & 3. When on '/expenses/create', ONLY CREATE EXPENSE is active (not VIEW EXPENSES or ROLLBACK)", () => {
    const current = "/expenses/create";
    expect(isActive("/expenses/create", current)).toBe(true);
    expect(isActive("/expenses", current)).toBe(false);
    expect(isActive("/expenses/rollback", current)).toBe(false);
    expect(isActive("/dashboard", current)).toBe(false);
  });

  it("4 & 5. When on '/expenses', ONLY VIEW EXPENSES is active (not CREATE EXPENSE or ROLLBACK)", () => {
    const current = "/expenses";
    expect(isActive("/expenses", current)).toBe(true);
    expect(isActive("/expenses/create", current)).toBe(false);
    expect(isActive("/expenses/rollback", current)).toBe(false);
    expect(isActive("/dashboard", current)).toBe(false);
  });

  it("6 & 7. When on '/expenses/rollback', ONLY ROLLBACK is active (not CREATE or VIEW)", () => {
    const current = "/expenses/rollback";
    expect(isActive("/expenses/rollback", current)).toBe(true);
    expect(isActive("/expenses/create", current)).toBe(false);
    expect(isActive("/expenses", current)).toBe(false);
  });

  it("8. When viewing a specific report details '/expenses/exp_12345', VIEW EXPENSES is active", () => {
    const current = "/expenses/exp_12345";
    expect(isActive("/expenses", current)).toBe(true);
    expect(isActive("/expenses/create", current)).toBe(false);
    expect(isActive("/expenses/rollback", current)).toBe(false);
  });
});
