import { Text, View } from "react-native";
import { iconSlotStyles } from "./icon-slot.styles";

interface IconSlotProps {
  mark: string;
}

function IconSlot({ mark }: IconSlotProps): React.JSX.Element {
  return (
    <View style={iconSlotStyles.icon}>
      <Text style={iconSlotStyles.mark}>{mark}</Text>
    </View>
  );
}

export { IconSlot };
