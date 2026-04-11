import { PanelBody, PanelTopBar } from "@/ui";
import { PanelPreviewScrollContent } from "./panel-preview-scroll-content";

function PanelPreviewContent(): React.JSX.Element {
  return (
    <>
      <PanelTopBar icons={["□", "‹", "›"]} />
      <PanelBody>
        <PanelPreviewScrollContent />
      </PanelBody>
    </>
  );
}

export { PanelPreviewContent };
