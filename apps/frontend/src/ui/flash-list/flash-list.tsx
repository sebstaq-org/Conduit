import { FlashList } from "@shopify/flash-list";
import type {
  FlashListProps,
  FlashListRef,
  ListRenderItemInfo,
} from "@shopify/flash-list";

interface VirtualListProps<Item> {
  contentContainerStyle?: FlashListProps<Item>["contentContainerStyle"];
  data: FlashListProps<Item>["data"];
  getItemType?: FlashListProps<Item>["getItemType"];
  ItemSeparatorComponent?: FlashListProps<Item>["ItemSeparatorComponent"];
  keyExtractor: (item: Item, index: number) => string;
  keyboardDismissMode?: FlashListProps<Item>["keyboardDismissMode"];
  keyboardShouldPersistTaps?: FlashListProps<Item>["keyboardShouldPersistTaps"];
  listKey?: string;
  listRef?: React.Ref<FlashListRef<Item>> | undefined;
  maintainVisibleContentPosition?: FlashListProps<Item>["maintainVisibleContentPosition"];
  onContentSizeChange?: FlashListProps<Item>["onContentSizeChange"];
  onLoad?: FlashListProps<Item>["onLoad"];
  onScroll?: FlashListProps<Item>["onScroll"];
  onStartReached?: FlashListProps<Item>["onStartReached"];
  onStartReachedThreshold?: FlashListProps<Item>["onStartReachedThreshold"];
  renderItem: (info: ListRenderItemInfo<Item>) => React.ReactElement | null;
  scrollEventThrottle?: FlashListProps<Item>["scrollEventThrottle"];
  showsVerticalScrollIndicator?: boolean;
  style?: FlashListProps<Item>["style"];
}

function VirtualList<Item>({
  contentContainerStyle,
  data,
  getItemType,
  ItemSeparatorComponent,
  keyExtractor,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  listKey,
  listRef,
  maintainVisibleContentPosition,
  onContentSizeChange,
  onLoad,
  onScroll,
  onStartReached,
  onStartReachedThreshold,
  renderItem,
  scrollEventThrottle,
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
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      maintainVisibleContentPosition={maintainVisibleContentPosition}
      onContentSizeChange={onContentSizeChange}
      onLoad={onLoad}
      onScroll={onScroll}
      onStartReached={onStartReached}
      onStartReachedThreshold={onStartReachedThreshold}
      renderItem={renderItem}
      ref={listRef}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      style={style}
    />
  );
}

export { VirtualList };
export type { VirtualListProps };
