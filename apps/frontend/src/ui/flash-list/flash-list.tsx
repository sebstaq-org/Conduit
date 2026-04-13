import { FlashList } from "@shopify/flash-list";
import type { FlashListProps, ListRenderItemInfo } from "@shopify/flash-list";

interface VirtualListProps<Item> {
  contentContainerStyle?: FlashListProps<Item>["contentContainerStyle"];
  data: FlashListProps<Item>["data"];
  getItemType?: FlashListProps<Item>["getItemType"];
  ItemSeparatorComponent?: FlashListProps<Item>["ItemSeparatorComponent"];
  keyExtractor: (item: Item, index: number) => string;
  listKey?: string;
  maintainVisibleContentPosition?: FlashListProps<Item>["maintainVisibleContentPosition"];
  onStartReached?: FlashListProps<Item>["onStartReached"];
  onStartReachedThreshold?: FlashListProps<Item>["onStartReachedThreshold"];
  renderItem: (info: ListRenderItemInfo<Item>) => React.ReactElement | null;
  showsVerticalScrollIndicator?: boolean;
  style?: FlashListProps<Item>["style"];
}

function VirtualList<Item>({
  contentContainerStyle,
  data,
  getItemType,
  ItemSeparatorComponent,
  keyExtractor,
  listKey,
  maintainVisibleContentPosition,
  onStartReached,
  onStartReachedThreshold,
  renderItem,
  showsVerticalScrollIndicator,
  style,
}: VirtualListProps<Item>): React.JSX.Element {
  return (
    <FlashList
      contentContainerStyle={contentContainerStyle}
      data={data}
      getItemType={getItemType}
      ItemSeparatorComponent={ItemSeparatorComponent}
      key={listKey}
      keyExtractor={keyExtractor}
      maintainVisibleContentPosition={maintainVisibleContentPosition}
      onStartReached={onStartReached}
      onStartReachedThreshold={onStartReachedThreshold}
      renderItem={renderItem}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      style={style}
    />
  );
}

export { VirtualList };
export type { VirtualListProps };
