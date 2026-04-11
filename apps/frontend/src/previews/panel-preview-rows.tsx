import { PanelPreviewProjectRows } from "./panel-preview-project-rows";
import { PanelPreviewThreadSection } from "./panel-preview-thread-section";

function PanelPreviewRows(): React.JSX.Element {
  return (
    <>
      <PanelPreviewProjectRows />
      <PanelPreviewThreadSection />
    </>
  );
}

export { PanelPreviewRows };
