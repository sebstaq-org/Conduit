import { PanelHost } from "@/ui";
import { PanelPreviewContent } from "./panel-preview-content";

function PanelPreviewScreen(): React.JSX.Element {
  return (
    <PanelHost>
      <PanelPreviewContent />
    </PanelHost>
  );
}

export { PanelPreviewScreen };
