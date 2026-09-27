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

type MultiChoiceTabsProps = {
  label?: string;
  values: number[];
  onChange: (values: number[]) => void;
  options: { value: number; label: string }[];
  disabled?: boolean;
};

export function MultiChoiceTabs({
  label,
  values,
  onChange,
  options,
  disabled,
}: MultiChoiceTabsProps) {
  function toggle(id: number) {
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  }

  return (
    <div>
      {label ? (
        <p className="mb-1.5 text-xs font-medium text-gray-600">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt.value)}
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
