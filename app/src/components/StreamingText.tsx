import { useEffect, useRef, useState } from "react";
import { Text, type TextStyle } from "react-native";

/**
 * Typewriter render of the MedPsy explanation. The real core/ will expose a token stream
 * (handle TBD); until then we simulate streaming over the returned string. Set `enabled={false}`
 * to render instantly.
 */
export function StreamingText({
  text,
  style,
  speedMs = 14,
  enabled = true,
}: {
  text: string;
  style?: TextStyle | TextStyle[];
  speedMs?: number;
  enabled?: boolean;
}) {
  const [shown, setShown] = useState(enabled ? "" : text);
  const idx = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setShown(text);
      return;
    }
    idx.current = 0;
    setShown("");
    const id = setInterval(() => {
      idx.current += 2;
      if (idx.current >= text.length) {
        setShown(text);
        clearInterval(id);
      } else {
        setShown(text.slice(0, idx.current));
      }
    }, speedMs);
    return () => clearInterval(id);
  }, [text, enabled, speedMs]);

  return <Text style={style}>{shown}</Text>;
}
