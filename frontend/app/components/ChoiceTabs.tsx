const tabBase =
  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition";
const tabSelected = "border-emerald-600 bg-emerald-600 text-white";
const tabIdle =
  "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50";

type ChoiceTabsProps<T extends string | number> = {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
};

export function ChoiceTabs<T extends string | number>({
  label,
  value,
  onChange,
  options,
  disabled,
}: ChoiceTabsProps<T>) {
  return (
    <div>
      {label ? (
        <p className="mb-1.5 text-xs font-medium text-gray-600">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`${tabBase} ${selected ? tabSelected : tabIdle} disabled:opacity-50`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
