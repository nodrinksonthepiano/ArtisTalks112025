'use client'

interface SelectOption {
  label: string
  value: string
}

interface InlineSelectPickerProps {
  options: SelectOption[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
}

export default function InlineSelectPicker({
  options,
  value,
  onChange,
  disabled = false,
}: InlineSelectPickerProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {options.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className="w-full text-left px-4 py-3 rounded-lg transition-colors text-sm font-light"
            style={{
              color: '#fffacd',
              textShadow: isSelected
                ? '0 0 8px rgba(255, 215, 0, 0.9), 2px 2px 4px rgba(0, 0, 0, 0.7)'
                : '0 0 3px rgba(255, 215, 0, 0.4), 1px 1px 2px rgba(0, 0, 0, 0.5)',
              backgroundColor: isSelected ? 'rgba(4, 120, 87, 0.6)' : 'rgba(0, 0, 0, 0.35)',
              border: isSelected
                ? '1px solid rgba(255, 215, 0, 0.7)'
                : '1px solid rgba(255, 255, 255, 0.2)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
            aria-pressed={isSelected}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
