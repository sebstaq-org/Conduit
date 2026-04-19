import { Text as NativeText } from "react-native";
import {
  Extrapolation,
  createAnimatedComponent,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import type { Theme } from "@/theme";

const glimmerWidth = 2.4;
const AnimatedText = createAnimatedComponent(NativeText);

interface GlimmerGlyphProps {
  glyph: string;
  glyphCount: number;
  position: number;
  progress: SharedValue<number>;
  theme: Theme;
}

function GlimmerGlyph({
  glyph,
  glyphCount,
  position,
  progress,
  theme,
}: GlimmerGlyphProps): React.JSX.Element {
  const glyphStyle = useAnimatedStyle(() => {
    const center = progress.value * (glyphCount + glimmerWidth) - glimmerWidth;
    const distance = Math.abs(position - center);
    return {
      opacity: interpolate(
        distance,
        [0, glimmerWidth, glimmerWidth * 2],
        [1, 0.82, 0.64],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <AnimatedText
      accessible={false}
      style={[
        {
          color: theme.colors.textPrimary,
          fontSize: theme.textVariants.meta.fontSize,
          fontWeight: theme.textVariants.meta.fontWeight,
          lineHeight: theme.textVariants.meta.lineHeight,
        },
        glyphStyle,
      ]}
    >
      {glyph}
    </AnimatedText>
  );
}

export { GlimmerGlyph };
export type { GlimmerGlyphProps };
