import { Section } from "@/ui";
import { PanelPreviewThreadActions } from "./panel-preview-thread-actions";
import { PanelPreviewThreadRows } from "./panel-preview-thread-rows";

function PanelPreviewThreadSection(): React.JSX.Element {
  return (
    <Section actions={<PanelPreviewThreadActions />} title="Threads">
      <PanelPreviewThreadRows />
    </Section>
  );
}

export { PanelPreviewThreadSection };
