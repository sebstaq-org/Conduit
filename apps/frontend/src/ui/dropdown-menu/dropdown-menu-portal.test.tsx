/* eslint-disable jest/no-conditional-in-test, jest/no-untyped-mock-factory, typescript-eslint/no-unsafe-type-assertion, vitest/prefer-import-in-mock */
import { createElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenuPortal } from "./dropdown-menu-portal";
import { DropdownMenuPortal as NativeDropdownMenuPortal } from "./dropdown-menu-portal.native";

interface PrimitiveProps {
  readonly children?: ReactNode;
  readonly style?: unknown;
}

const primitiveNames = vi.hoisted(() => ({
  overlay: "DropdownMenuOverlay",
  portal: "DropdownMenuPortalPrimitive",
}));

vi.mock("react-native", () => ({
  StyleSheet: {
    create: <Styles extends object>(styles: Styles): Styles => styles,
  },
}));

vi.mock("@rn-primitives/dropdown-menu", () => ({
  Overlay: primitiveNames.overlay,
  Portal: primitiveNames.portal,
}));

function requireElement(value: ReactNode): ReactElement<PrimitiveProps> {
  if (!isValidElement<PrimitiveProps>(value)) {
    throw new Error("Expected React element.");
  }
  return value;
}

function requireChildrenArray(value: ReactNode): readonly ReactNode[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected portal children array.");
  }
  return value as readonly ReactNode[];
}

type PortalComponent = (props: {
  readonly children: ReactNode;
}) => React.JSX.Element;

function renderPortalElement(
  component: PortalComponent,
  child: ReactNode,
): ReactElement<PrimitiveProps> {
  const renderDropdownMenuPortal = component;
  return requireElement(renderDropdownMenuPortal({ children: child }));
}

describe("native dropdown portal contract", () => {
  it("keeps web dropdown content inside the primitive portal without a full-page overlay", () => {
    const dropdownContent = createElement("DropdownMenuContent");
    const element = renderPortalElement(DropdownMenuPortal, dropdownContent);

    expect(element.type).toBe(primitiveNames.portal);
    expect(element.props.children).toBe(dropdownContent);
  });

  it("renders native dropdown children through the primitive portal above a dismiss overlay", () => {
    const dropdownContent = createElement("DropdownMenuContent");
    const element = renderPortalElement(NativeDropdownMenuPortal, dropdownContent);
    const children = requireChildrenArray(element.props.children);
    const overlay = requireElement(children.at(0));

    expect(element.type).toBe(primitiveNames.portal);
    expect(children).toHaveLength(2);
    expect(overlay.type).toBe(primitiveNames.overlay);
    expect(children.at(1)).toBe(dropdownContent);
  });
});
