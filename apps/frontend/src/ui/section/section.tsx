import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { sectionStyles } from "./section.styles";

interface SectionProps {
  actions?: ReactNode | undefined;
  children: ReactNode;
  title: string;
}

function Section({ actions, children, title }: SectionProps): React.JSX.Element {
  return (
    <View>
      <View style={sectionStyles.heading}>
        <Text style={sectionStyles.title}>{title}</Text>
        {actions !== undefined && <View style={sectionStyles.actions}>{actions}</View>}
      </View>
      {children}
    </View>
  );
}

export { Section };
