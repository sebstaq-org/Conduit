import { List, Row } from "@/ui";

const projectRows = [
  { icon: "✎", id: "new-chat", label: "New chat" },
  { icon: "⌕", id: "search", label: "Search" },
  { icon: "⌘", id: "plugins", label: "Plugins" },
  { icon: "◷", id: "automations", label: "Automations" },
] as const;

function PanelPreviewProjectRows(): React.JSX.Element {
  return (
    <List>
      {projectRows.map((row) => (
        <Row key={row.id} icon={row.icon} label={row.label} />
      ))}
    </List>
  );
}

export { PanelPreviewProjectRows };
