import { Row } from "@/ui";
import { PanelPreviewProjectRows } from "./panel-preview-project-rows";
import { PanelPreviewThreadSection } from "./panel-preview-thread-section";

function PanelPreviewRows(): React.JSX.Element {
  return (
    <>
      <PanelPreviewProjectRows />
      <Row icon="⌁" label="Testa funktionalitet" meta="5d" />
      <PanelPreviewThreadSection />
    </>
  );
}

export { PanelPreviewRows };
