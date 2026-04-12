import type { ReactNode } from "react";
import { Section } from "@/ui";
import { SessionListRows } from "./session-list-rows";

interface SessionListProps {
  actions?: ReactNode | undefined;
  onSessionSelected?: (() => void) | undefined;
}

function SessionList({
  actions,
  onSessionSelected,
}: SessionListProps): React.JSX.Element {
  return (
    <Section actions={actions} title="Threads">
      <SessionListRows onSessionSelected={onSessionSelected} />
    </Section>
  );
}

export { SessionList };
