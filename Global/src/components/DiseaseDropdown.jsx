// src/components/DiseaseDropdown.jsx
import { useEffect, useMemo, useState } from 'react'
import Select from 'react-select'

export default function DiseaseDropdown({
  value,
  onChange,
  label = 'Disease',
  placeholder = 'Select disease…',
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        setError('')
        const res = await fetch('/diseases.json')
        if (!res.ok) throw new Error(`Failed to load diseases.json (${res.status})`)
        const list = await res.json()
        if (!alive) return

        const cleaned = (Array.isArray(list) ? list : [])
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter(Boolean)

        setItems(cleaned)
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load diseases')
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [])

  const options = useMemo(
    () => items.map((d) => ({ value: d, label: d })),
    [items]
  )

  const selected = useMemo(() => {
    if (!value) return null
    return { value, label: value }
  }, [value])

  const styles = useMemo(
    () => ({
      container: (base) => ({ ...base, width: '100%' }),
      control: (base, state) => ({
        ...base,
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        border: state.isFocused
          ? '1px solid rgba(0,160,255,0.9)'
          : '1px solid rgba(255,255,255,0.16)',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(0,160,255,0.18)' : 'none',
        cursor: 'pointer',
      }),
      valueContainer: (base) => ({ ...base, padding: '0 10px' }),
      singleValue: (base) => ({ ...base, color: 'white', fontWeight: 700 }),
      placeholder: (base) => ({ ...base, color: 'rgba(255,255,255,0.55)' }),
      input: (base) => ({ ...base, color: 'white' }),
      indicatorSeparator: () => ({ display: 'none' }),
      dropdownIndicator: (base, state) => ({
        ...base,
        color: 'rgba(255,255,255,0.75)',
        transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 140ms ease',
      }),
      menu: (base) => ({
        ...base,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: 'rgba(15, 18, 25, 0.98)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 14px 45px rgba(0,0,0,0.55)',
        marginTop: 8,
      }),
      menuList: (base) => ({
        ...base,
        padding: 8,
        maxHeight: 260,
      }),
      option: (base, state) => ({
        ...base,
        borderRadius: 12,
        padding: '10px 12px',
        margin: '4px 0',
        cursor: 'pointer',
        color: 'white',
        backgroundColor: state.isSelected
          ? 'rgba(0,160,255,0.25)'
          : state.isFocused
          ? 'rgba(255,255,255,0.10)'
          : 'transparent',
      }),
      noOptionsMessage: (base) => ({ ...base, color: 'rgba(255,255,255,0.65)' }),
      loadingMessage: (base) => ({ ...base, color: 'rgba(255,255,255,0.65)' }),
    }),
    []
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 12, opacity: 0.9 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          {loading ? 'Loading…' : options.length ? `${options.length}` : ''}
        </div>
      </div>

      <Select
        isClearable
        isSearchable
        isLoading={loading}
        options={options}
        value={selected}
        onChange={(opt) => onChange(opt?.value ?? '')}
        placeholder={placeholder}
        styles={styles}
        menuPlacement="auto"
      />

      {error ? (
        <div style={{ fontSize: 12, color: '#ffb4b4' }}>
          {error} — make sure <b>public/diseases.json</b> exists.
        </div>
      ) : null}
    </div>
  )
}
