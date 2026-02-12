import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ChevronDownIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { useState } from 'react'

export function TabCustomerPJ() {
  const [date, setDate] = useState<Date>()

  return (
    <div className='space-y-4'>
      <FieldGroup>
        <Field className='gap-1'>
          <FieldLabel>Nome da empresa *</FieldLabel>
          <Input placeholder='Ex: Razão social ou nome fantasia' />
        </Field>
      </FieldGroup>
      <div className='flex items-center gap-4'>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Tipo de documento *</FieldLabel>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="CPF">CPF</SelectItem>
                  <SelectItem value="IE">Inscrição Estadual</SelectItem>
                  <SelectItem value="OTHER">Outros</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Nº do documento *</FieldLabel>
            <Input placeholder='00.000.000/0000-00' />
          </Field>
        </FieldGroup>
      </div>
      <div className='flex items-center gap-4'>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Email *</FieldLabel>
            <Input placeholder='email@exemplo.com' />
          </Field>
        </FieldGroup>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Telefone</FieldLabel>
            <Input placeholder='(00) 00000-0000' />
          </Field>
        </FieldGroup>
      </div>
      <Separator />
      <div className='space-y-4'>
        <h3 className='text-muted-foreground text-sm'>Dados Pessoa Jurídica</h3>
        <div className='flex items-center gap-4'>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Nome fantasia</FieldLabel>
              <Input placeholder='Nome fantasia' />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Razão social</FieldLabel>
              <Input placeholder='Razão social completa' />
            </Field>
          </FieldGroup>
        </div>
        <div className='flex items-center gap-4'>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Inscrição estadual</FieldLabel>
              <Input placeholder='Inscrição estadual' />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Inscrição municipal</FieldLabel>
              <Input placeholder='Inscrição municipal' />
            </Field>
          </FieldGroup>
        </div>
        <div className='flex items-center gap-4'>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Data de fundação</FieldLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-empty={!date}
                    className="data-[empty=true]:text-muted-foreground w-[212px] justify-between text-left font-normal"
                  >
                    {date ? format(date, "PPP") : <span>dd / mm / aaaa</span>}
                    <ChevronDownIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    defaultMonth={date}
                  />
                </PopoverContent>
              </Popover>
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Atividade empresarial</FieldLabel>
              <Input placeholder='Ex: Comércio varejista' />
            </Field>
          </FieldGroup>
        </div>
      </div>
    </div>
  )
}