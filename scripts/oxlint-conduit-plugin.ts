type NodeKind =
  | "BinaryExpression"
  | "ConditionalExpression"
  | "Identifier"
  | "ImportDeclaration"
  | "ImportSpecifier"
  | "JSXElement"
  | "JSXEmptyExpression"
  | "JSXExpressionContainer"
  | "JSXIdentifier"
  | "JSXOpeningElement"
  | "JSXText"
  | "Literal"
  | "MemberExpression"
  | "TemplateLiteral";

interface BaseNode<NodeType extends NodeKind = NodeKind> {
  type: NodeType;
}

interface NamedNode<
  NodeType extends NodeKind = "Identifier" | "JSXIdentifier",
> extends BaseNode<NodeType> {
  name: string;
}

interface LiteralNode extends BaseNode<"Literal"> {
  value?: unknown;
}

interface ImportDeclarationNode extends BaseNode<"ImportDeclaration"> {
  source?: LiteralNode;
  specifiers?: RuleNode[];
}

interface ImportSpecifierNode extends BaseNode<"ImportSpecifier"> {
  imported?: RuleNode;
}

interface BinaryNode extends BaseNode<"BinaryExpression"> {
  operator: string;
}

interface JSXExpressionContainerNode extends BaseNode<"JSXExpressionContainer"> {
  expression?: RuleNode;
}

interface JSXTextNode extends BaseNode<"JSXText"> {
  value: string;
}

interface JSXOpeningElementNode extends BaseNode<"JSXOpeningElement"> {
  name?: RuleNode;
  parent?: RuleNode;
}

interface JSXElementNode extends BaseNode<"JSXElement"> {
  children?: RuleNode[];
}

type RuleNode =
  | BaseNode
  | BinaryNode
  | JSXElementNode
  | JSXExpressionContainerNode
  | JSXOpeningElementNode
  | JSXTextNode
  | LiteralNode
  | NamedNode;

interface ReportDescriptor {
  data?: Record<string, string>;
  messageId: string;
  node: RuleNode;
}

interface RuleContext {
  getFilename(): string;
  report(descriptor: ReportDescriptor): void;
}

interface RuleListeners {
  ImportDeclaration?(node: ImportDeclarationNode): void;
  JSXOpeningElement?(node: JSXOpeningElementNode): void;
  Literal?(node: LiteralNode): void;
}

const restrictedHtmlTextElements = new Set(
  "abbr address article aside b blockquote caption cite code dd del dfn div dt em figcaption footer h1 h2 h3 h4 h5 h6 header i ins kbd label legend li main mark nav p pre q s samp section small span strong sub summary sup td th time u var".split(
    " ",
  ),
);

function isJsxElement(node: RuleNode | undefined): node is JSXElementNode {
  return node !== undefined && node.type === "JSXElement";
}

function isJsxExpressionContainer(
  node: RuleNode,
): node is JSXExpressionContainerNode {
  return node.type === "JSXExpressionContainer";
}

function isJsxIdentifier(node: RuleNode | undefined): node is NamedNode {
  return node !== undefined && node.type === "JSXIdentifier";
}

function isJsxText(node: RuleNode): node is JSXTextNode {
  return node.type === "JSXText";
}

function isBinaryExpression(node: RuleNode): node is BinaryNode {
  return node.type === "BinaryExpression";
}

function isIdentifier(node: RuleNode): node is NamedNode<"Identifier"> {
  return node.type === "Identifier";
}

function isImportSpecifier(
  node: RuleNode | undefined,
): node is ImportSpecifierNode {
  return node !== undefined && node.type === "ImportSpecifier";
}

function isLiteral(node: RuleNode): node is LiteralNode {
  return node.type === "Literal";
}

function isTextExpression(node: RuleNode): boolean {
  if (node.type === "JSXEmptyExpression") {
    return false;
  }

  if (isLiteral(node)) {
    return typeof node.value === "string" && node.value.trim().length > 0;
  }

  if (isIdentifier(node)) {
    return node.name !== "null" && node.name !== "undefined";
  }

  return (
    (isBinaryExpression(node) && node.operator === "+") ||
    node.type === "ConditionalExpression" ||
    node.type === "MemberExpression" ||
    node.type === "TemplateLiteral"
  );
}

function hasTextValue(node: RuleNode): boolean {
  if (isJsxText(node)) {
    return node.value.trim().length > 0;
  }

  if (!isJsxExpressionContainer(node)) {
    return false;
  }

  return node.expression !== undefined && isTextExpression(node.expression);
}

function hasDirectTextChild(node: JSXElementNode): boolean {
  return (node.children ?? []).some((child) => hasTextValue(child));
}

function importsNamedSpecifier(
  node: ImportDeclarationNode,
  importedName: string,
): boolean {
  return (node.specifiers ?? []).some(
    (specifier) =>
      isImportSpecifier(specifier) &&
      specifier.imported !== undefined &&
      isIdentifier(specifier.imported) &&
      specifier.imported.name === importedName,
  );
}

function isFrontendThemeFile(filename: string): boolean {
  return filename.replaceAll("\\", "/").includes("apps/frontend/src/theme/");
}

function isHexColor(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^#(?:[\da-fA-F]{3}|[\da-fA-F]{4}|[\da-fA-F]{6}|[\da-fA-F]{8})$/.test(value)
  );
}

const noPlainHtmlTextElements = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct text children in plain HTML elements. Use Conduit design-system typography components.",
    },
    messages: {
      noPlainHtmlText:
        "Do not place text directly in <{{element}}>; use Conduit design-system typography components instead.",
    },
    schema: [],
  },
  create(context: RuleContext): RuleListeners {
    return {
      JSXOpeningElement(node: JSXOpeningElementNode): void {
        const { name, parent } = node;
        if (!isJsxIdentifier(name)) {
          return;
        }

        const elementName = name.name;
        if (
          elementName === "" ||
          !restrictedHtmlTextElements.has(elementName)
        ) {
          return;
        }

        if (isJsxElement(parent) && hasDirectTextChild(parent)) {
          context.report({
            data: { element: elementName },
            messageId: "noPlainHtmlText",
            node,
          });
        }
      },
    };
  },
};

const noFrontendStylesheet = {
  meta: {
    type: "problem",
    messages: {
      noStyleSheet:
        "Do not import StyleSheet in frontend code; use Conduit Restyle theme props instead.",
    },
    schema: [],
  },
  create(context: RuleContext): RuleListeners {
    return {
      ImportDeclaration(node: ImportDeclarationNode): void {
        if (node.source?.value !== "react-native") {
          return;
        }

        if (importsNamedSpecifier(node, "StyleSheet")) {
          context.report({
            messageId: "noStyleSheet",
            node,
          });
        }
      },
    };
  },
};

const noFrontendRawHexColor = {
  meta: {
    type: "problem",
    messages: {
      noRawHexColor:
        "Do not use raw hex colors outside apps/frontend/src/theme; add a semantic theme token instead.",
    },
    schema: [],
  },
  create(context: RuleContext): RuleListeners {
    return {
      Literal(node: LiteralNode): void {
        if (
          !isHexColor(node.value) ||
          isFrontendThemeFile(context.getFilename())
        ) {
          return;
        }

        context.report({
          messageId: "noRawHexColor",
          node,
        });
      },
    };
  },
};

const conduitPlugin = {
  meta: {
    name: "conduit",
  },
  rules: {
    "no-frontend-raw-hex-color": noFrontendRawHexColor,
    "no-frontend-stylesheet": noFrontendStylesheet,
    "no-plain-html-text-elements": noPlainHtmlTextElements,
  },
};
export default conduitPlugin;
