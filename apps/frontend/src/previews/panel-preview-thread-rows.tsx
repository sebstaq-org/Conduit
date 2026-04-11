import { List, Row } from "@/ui";
import type { IconSlotName } from "@/ui/icon-slot/icon-slot";

interface ThreadRow {
  depth: number;
  icon?: IconSlotName | undefined;
  id: string;
  label: string;
  meta?: string | undefined;
  muted?: boolean | undefined;
}

const threadRows: ThreadRow[] = [
  {
    depth: 0,
    icon: { family: "material-community", name: "pin-outline" },
    id: "pinned-session",
    label: "Pinned session",
    meta: "5d",
  },
  { depth: 0, icon: "folder", id: "base", label: "base" },
  { depth: 0, icon: "folder", id: "thread-lens-a", label: "thread-lens" },
  {
    depth: 1,
    id: "proof-collection",
    label: "Du ska genomföra den första faktiska bevisinsamling...",
    meta: "3d",
  },
  {
    depth: 1,
    id: "new-document",
    label: "Du ska ta fram ett nytt dokument i /srv/devops/obsid...",
    meta: "3d",
  },
  {
    depth: 1,
    id: "write-note",
    label: "Du ska skriva /srv/devops/obsidian-notes/Personal/...",
    meta: "3d",
  },
  {
    depth: 1,
    id: "strengthen-document",
    label: "Du ska stärka dokumentet /srv/devops/obsidian-not...",
    meta: "3d",
  },
  { depth: 0, icon: "folder", id: "validaite", label: "validAIte" },
  { depth: 1, id: "no-chats", label: "No chats", muted: true },
  { depth: 0, icon: "folder", id: "thread-lens-b", label: "thread-lens" },
  { depth: 0, icon: "folder", id: "thread-lens-c", label: "thread-lens" },
  { depth: 0, icon: "folder", id: "thread-lens-d", label: "thread-lens" },
  { depth: 0, icon: "folder", id: "thread-lens-e", label: "thread-lens" },
];

function PanelPreviewThreadRows(): React.JSX.Element {
  return (
    <List>
      {threadRows.map((row) => (
        <Row
          key={row.id}
          depth={row.depth}
          icon={row.icon}
          label={row.label}
          meta={row.meta}
          muted={row.muted}
        />
      ))}
    </List>
  );
}

export { PanelPreviewThreadRows };
