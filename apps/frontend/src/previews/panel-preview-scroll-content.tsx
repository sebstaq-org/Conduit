import { ScrollArea } from "@/ui";
import { PanelPreviewRows } from "./panel-preview-rows";

function PanelPreviewScrollContent(): React.JSX.Element {
  return (
    <ScrollArea>
      <PanelPreviewRows />
    </ScrollArea>
  );
}

export { PanelPreviewScrollContent };
