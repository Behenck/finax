import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { applyDateInputMask } from '@/utils/date-mask'

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
  const displayValue = value ? format(value, 'dd/MM/yyyy') : ''

  return (
    <div className="relative flex items-center">
      <Input
        value={displayValue}
        placeholder="dd/mm/aaaa"
        aria-invalid={invalid}
        onChange={(e) => {
          const masked = applyDateInputMask(e.target.value)

          if (masked.length !== 10) {
            onChange(undefined)
            return
          }

          const [day, month, year] = masked.split('/')
          const parsed = new Date(`${year}-${month}-${day}`)

          if (isNaN(parsed.getTime())) {
            onChange(undefined)
            return
          }

          onChange(parsed)
        }}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-1"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="p-0">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
