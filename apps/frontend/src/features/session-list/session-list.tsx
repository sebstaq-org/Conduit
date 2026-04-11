import { Section } from "@/ui";
import { SessionListActions } from "./session-list-actions";
import { SessionListRows } from "./session-list-rows";

function SessionList(): React.JSX.Element {
  return (
    <Section actions={<SessionListActions />} title="Threads">
      <SessionListRows />
    </Section>
  );
}

export { SessionList };
