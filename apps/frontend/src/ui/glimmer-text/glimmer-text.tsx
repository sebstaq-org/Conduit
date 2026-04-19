import { useTheme } from "@shopify/restyle";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
import { Box } from "@/theme";
import type { Theme } from "@/theme";
import { GlimmerGlyph } from "./glimmer-glyph";

const glimmerCycleMs = 1400;

interface GlimmerTextProps {
  text: string;
}

interface GlimmerGlyphModel {
  glyph: string;
  key: string;
  position: number;
}

function glimmerGlyphs(text: string): GlimmerGlyphModel[] {
  // eslint-disable-next-line unicorn/prefer-spread -- this component renders ASCII status copy and avoids the string-spread lint conflict.
  return Array.from(text).map((glyph, position) => ({
    glyph,
    key: `${position.toString(36)}:${glyph.codePointAt(0) ?? 0}`,
    position,
  }));
}

function GlimmerText({ text }: GlimmerTextProps): React.JSX.Element {
  const theme = useTheme<Theme>();
  const progress = useSharedValue(0);
  const glyphs = glimmerGlyphs(text);

  useFrameCallback((frame) => {
    progress.value = (frame.timestamp % glimmerCycleMs) / glimmerCycleMs;
  });

  return (
    <Box
      accessibilityLabel={text}
      accessible
      flexDirection="row"
      minHeight={theme.textVariants.meta.lineHeight}
    >
      {glyphs.map((glyph) => (
        <GlimmerGlyph
          glyph={glyph.glyph}
          glyphCount={glyphs.length}
          key={glyph.key}
          position={glyph.position}
          progress={progress}
          theme={theme}
        />
      ))}
    </Box>
  );
}

export { GlimmerText };
