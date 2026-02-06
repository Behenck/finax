import { format, parse } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { applyDateInputMask } from '@/utils/date-mask'
import { useEffect, useState } from 'react'

interface DateInputProps {
  value?: Date
  onChange: (value: Date | undefined) => void
  invalid?: boolean
}

export function DateInput({
  value,
  onChange,
  invalid,
}: DateInputProps) {
  const [inputValue, setInputValue] = useState('')

  // 🔄 sincroniza quando vem valor externo (calendar / form reset etc)
  useEffect(() => {
    if (value) {
      setInputValue(format(value, 'dd/MM/yyyy'))
    } else {
      setInputValue('')
    }
  }, [value])

  function handleInputChange(raw: string) {
    const masked = applyDateInputMask(raw)
    setInputValue(masked)

    if (masked.length !== 10) {
      onChange(undefined)
      return
    }

    const parsed = parse(
      masked,
      'dd/MM/yyyy',
      new Date()
    )

    if (isNaN(parsed.getTime())) {
      onChange(undefined)
      return
    }

    onChange(parsed)
  }

  return (
    <div className="relative flex items-center w-full">
      <Input
        value={inputValue}
        placeholder="dd/mm/aaaa"
        aria-invalid={invalid}
        onChange={(e) => handleInputChange(e.target.value)}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-1"
            onMouseDown={(e) => e.preventDefault()}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="p-0">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date)
              if (date) {
                setInputValue(format(date, 'dd/MM/yyyy'))
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
