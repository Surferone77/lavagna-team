// Display a 7 segmenti stile orologio da box: segmenti accesi colorati, spenti appena visibili.
//   a
// f   b
//   g
// e   c
//   d
const MAP = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  A: "abcefg", b: "fgedc", c: "ged", C: "afed", d: "bgedc", E: "afged", F: "afge", H: "fbgec", h: "fgec", L: "fed", n: "gec", N: "abcef",
  o: "gecd", P: "abfge", r: "ge", S: "afgcd", t: "fged", U: "bcdef", u: "ecd", y: "fbgcd", "-": "g", " ": "", "_": "d",
};

// poligoni dei segmenti in un riquadro 60×100
const SEG = {
  a: "10,4 50,4 44,12 16,12",
  b: "52,6 56,10 54,46 48,50 44,46 46,14",
  c: "48,52 54,56 52,92 48,96 44,88 42,56",
  d: "10,88 44,88 50,96 6,96",
  e: "6,54 12,50 16,54 14,86 8,94 4,90",
  f: "8,8 12,4 18,14 16,46 10,50 6,46",
  g: "14,46 46,46 50,50 44,54 12,54 8,50",
};

export function Digit({ ch, size = 80, on = "#B8FF2C", off = "rgba(255,255,255,0.05)", glow = true }) {
  const lit = MAP[ch] ?? "";
  return (
    <svg viewBox="0 0 60 100" width={size * 0.6} height={size} style={{ transform: "skewX(-6deg)", overflow: "visible", flexShrink: 0 }} aria-hidden="true">
      {Object.entries(SEG).map(([k, pts]) => {
        const isOn = lit.includes(k);
        return <polygon key={k} points={pts} fill={isOn ? on : off} style={isOn && glow ? { filter: `drop-shadow(0 0 ${size / 18}px ${on}88)` } : undefined} />;
      })}
    </svg>
  );
}

function Colon({ size, color, blink }) {
  return (
    <svg viewBox="0 0 20 100" width={size * 0.2} height={size} style={{ flexShrink: 0, opacity: blink ? 0.25 : 1, transition: "opacity .15s" }} aria-hidden="true">
      <circle cx="10" cy="34" r="5" fill={color} /><circle cx="8" cy="68" r="5" fill={color} />
    </svg>
  );
}

// Testo LED: cifre, lettere supportate e ":" come separatore
export default function SevenSeg({ text, size = 80, color = "#B8FF2C", off, blinkColon = false, gap = 0.08, label }) {
  return (
    <div role="img" aria-label={label || text} style={{ display: "inline-flex", alignItems: "center", gap: size * gap }}>
      {[...String(text)].map((ch, i) => ch === ":"
        ? <Colon key={i} size={size} color={color} blink={blinkColon} />
        : <Digit key={i} ch={ch} size={size} on={color} off={off} />)}
    </div>
  );
}
