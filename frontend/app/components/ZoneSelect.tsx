type ZoneOption = {
  value: string;
  label: string;
};

type ZoneSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ZoneOption[];
  placeholder?: string;
};

export function ZoneSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select a zone",
}: ZoneSelectProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-800">
        {label}
      </span>
      <select
        className="zone-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
