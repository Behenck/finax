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
import { Controller, useFormContext } from 'react-hook-form'
import { FieldError } from '@/components/field-error'
import type { CustomerFormInput } from '@/schemas/customer-schema'
import { formatDocument } from '@/utils/format-document'
import { formatPhone } from '@/utils/format-phone'

export function TabCustomerPF() {
  const {
    register,
    control,
    formState: { errors },
    watch,
  } = useFormContext<Extract<CustomerFormInput, { personType: "PF" }>>()

  const documentType = watch("documentType")

  return (
    <div className='space-y-4'>
      <FieldGroup>
        <Field className="gap-1">
          <FieldLabel>Nome completo *</FieldLabel>
          <Input placeholder='Ex: João da Silva' {...register("name")} />
          <FieldError error={errors.name} />
        </Field>
      </FieldGroup>
      <div className='flex items-center gap-4'>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Tipo de documento *</FieldLabel>
            <Controller
              name="documentType"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="RG">RG</SelectItem>
                        <SelectItem value="PASSPORT">Passaporte</SelectItem>
                        <SelectItem value="OTHER">Outros</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError error={fieldState.error} />
                </>
              )}
            />
          </Field>
        </FieldGroup>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Nº do documento *</FieldLabel>
            <Controller
              control={control}
              name="documentNumber"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    placeholder="000.000.000-00"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        formatDocument({
                          type: documentType,
                          value: e.target.value,
                        })
                      )
                    }
                  />
                  <FieldError error={fieldState.error} />
                </>
              )}
            />
          </Field>
        </FieldGroup>
      </div>
      <div className='flex items-center gap-4'>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Email</FieldLabel>
            <Input placeholder='email@exemplo.com' {...register("email")} />
            <FieldError error={errors.email} />
          </Field>
        </FieldGroup>
        <FieldGroup>
          <Field className='gap-1'>
            <FieldLabel>Telefone</FieldLabel>
            <Controller
              control={control}
              name="phone"
              render={({ field, fieldState }) => (
                <>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        formatPhone(
                          e.target.value,
                        )
                      )
                    }
                  />
                  <FieldError error={fieldState.error} />
                </>
              )}
            />
          </Field>
        </FieldGroup>
      </div>
      <Separator />
      <div className='space-y-4'>
        <h3 className='text-muted-foreground text-sm'>Dados Pessoa Física</h3>
        <div className='flex items-center gap-4'>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Data de nascimento</FieldLabel>
              <Controller
                name="birthDate"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-[212px] justify-between text-left font-normal"
                        >
                          {field.value
                            ? format(field.value, "dd/MM/yyyy")
                            : "dd / mm / aaaa"}
                          <ChevronDownIcon />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FieldError error={fieldState.error} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Naturalidade</FieldLabel>
              <Input placeholder='Ex: São Paulo - SP' {...register("naturality")} />
              <FieldError error={errors.naturality} />
            </Field>
          </FieldGroup>
        </div>
        <div className='flex items-center gap-4'>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Nome da mãe</FieldLabel>
              <Input placeholder='Nome completo' {...register("motherName")} />
              <FieldError error={errors.motherName} />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Nome do pai</FieldLabel>
              <Input placeholder='Nome completo' {...register("fatherName")} />
              <FieldError error={errors.fatherName} />
            </Field>
          </FieldGroup>
        </div>
        <div className='flex items-center gap-4'>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Profissão</FieldLabel>
              <Input placeholder='Ex: Engenheiro' {...register("profession")} />
              <FieldError error={errors.profession} />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Renda mensal (R$)</FieldLabel>
              <Input
                type="number"
                {...register("monthlyIncome", {
                  setValueAs: (v) => (v === "" || v == null ? 0 : Number(v) || 0),
                })}
              />
              <FieldError error={errors.monthlyIncome} />
            </Field>
          </FieldGroup>
        </div>
      </div>
    </div>
  )
}