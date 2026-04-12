import { Section } from "@/ui";
import { SessionListActions } from "./session-list-actions";
import { SessionListRows } from "./session-list-rows";

interface SessionListProps {
  onSessionSelected?: (() => void) | undefined;
}

function SessionList({
  onSessionSelected,
}: SessionListProps): React.JSX.Element {
  return (
    <Section actions={<SessionListActions />} title="Threads">
      <SessionListRows onSessionSelected={onSessionSelected} />
    </Section>
  );
}

export { SessionList };
