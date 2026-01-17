import { format, parse } from 'date-fns'

export function formatDateDisplayToISO(date: string) {
  if (!date) return ''

  const parsed = parse(date, 'dd/MM/yyyy', new Date())
  if (isNaN(parsed.getTime())) return ''

  return format(parsed, 'yyyy-MM-dd')
}

export function formatDateISOToDisplay(date: string) {
  if (!date) return ''

  const parsed = parse(date, 'yyyy-MM-dd', new Date())
  if (isNaN(parsed.getTime())) return ''

  return format(parsed, 'dd/MM/yyyy')
}
