import { List, Row } from "@/ui";

const projectRows = [
  { icon: "edit-2", id: "new-chat", label: "New chat" },
  { icon: "search", id: "search", label: "Search" },
  { icon: "grid", id: "plugins", label: "Plugins" },
  { icon: "clock", id: "automations", label: "Automations" },
] as const;

function NavigationPanelProjectRows(): React.JSX.Element {
  return (
    <List>
      {projectRows.map((row) => (
        <Row key={row.id} icon={row.icon} label={row.label} />
      ))}
    </List>
  );
}

export { NavigationPanelProjectRows };
