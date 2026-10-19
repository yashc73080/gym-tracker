import { COLORS, COLOR_HEX } from "@/lib/colors";

export function ColorPicker({ name = "color", value }: { name?: string; value?: string | null }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      {COLORS.map((c) => (
        <label key={c} className="cursor-pointer" title={c}>
          <input
            type="radio"
            name={name}
            value={c}
            defaultChecked={(value ?? "gray") === c}
            className="peer sr-only"
          />
          <span
            className="block h-7 w-7 rounded-full ring-offset-2 ring-offset-card peer-checked:ring-2 peer-focus-visible:ring-2 ring-white"
            style={{ background: COLOR_HEX[c] }}
          />
        </label>
      ))}
    </div>
  );
}
