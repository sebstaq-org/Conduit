type NodeKind =
  | "BinaryExpression"
  | "ConditionalExpression"
  | "Identifier"
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
  report(descriptor: ReportDescriptor): void;
}

interface RuleListeners {
  JSXOpeningElement(node: JSXOpeningElementNode): void;
}

const restrictedElements = new Set([
  "abbr",
  "address",
  "article",
  "aside",
  "b",
  "blockquote",
  "caption",
  "cite",
  "code",
  "dd",
  "del",
  "dfn",
  "div",
  "dt",
  "em",
  "figcaption",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "i",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "main",
  "mark",
  "nav",
  "p",
  "pre",
  "q",
  "s",
  "samp",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "td",
  "th",
  "time",
  "u",
  "var",
]);

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
        if (elementName === "" || !restrictedElements.has(elementName)) {
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

const conduitPlugin = {
  meta: {
    name: "conduit",
  },
  rules: {
    "no-plain-html-text-elements": noPlainHtmlTextElements,
  },
};

export default conduitPlugin;
