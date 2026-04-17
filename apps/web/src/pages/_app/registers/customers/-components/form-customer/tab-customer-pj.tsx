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
import type { CustomerFormInput } from '@/schemas/customer-schema'
import { FieldError } from '@/components/field-error'
import { formatDocument } from '@/utils/format-document'
import { formatPhone } from '@/utils/format-phone'
import { formatTitleCase } from '@/utils/format-title-case'

export function TabCustomerPJ() {
  const {
    register,
    control,
    formState: { errors },
    watch
  } = useFormContext<Extract<CustomerFormInput, { personType: "PJ" }>>()

  const documentType = watch("documentType")

  return (
    <div className='space-y-4'>
      <FieldGroup>
        <Field className='gap-1'>
          <FieldLabel>Nome da empresa *</FieldLabel>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <>
                <Input
                  placeholder='Ex: Razão social ou nome fantasia'
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(formatTitleCase(event.target.value))
                  }
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
                <FieldError error={fieldState.error} />
              </>
            )}
          />
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
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="IE">Inscrição Estadual</SelectItem>
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
                    placeholder="00-000-000/0000-00"
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
            <FieldLabel>Email *</FieldLabel>
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
        <h3 className='text-muted-foreground text-sm'>Dados Pessoa Jurídica</h3>
        <div className='flex items-center gap-4'>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Nome fantasia</FieldLabel>
              <Controller
                control={control}
                name="tradeName"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      placeholder='Nome fantasia'
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(formatTitleCase(event.target.value))
                      }
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                    <FieldError error={fieldState.error} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Razão social</FieldLabel>
              <Controller
                control={control}
                name="legalName"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      placeholder='Razão social completa'
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(formatTitleCase(event.target.value))
                      }
                      onBlur={field.onBlur}
                      ref={field.ref}
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
              <FieldLabel>Inscrição estadual</FieldLabel>
              <Input placeholder='Inscrição estadual' {...register("stateRegistration")} />
              <FieldError error={errors.stateRegistration} />
            </Field>
          </FieldGroup>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Inscrição municipal</FieldLabel>
              <Input placeholder='Inscrição municipal' {...register("municipalRegistration")} />
              <FieldError error={errors.municipalRegistration} />
            </Field>
          </FieldGroup>
        </div>
        <div className='flex items-center gap-4'>
          <FieldGroup>
            <Field className='gap-1'>
              <FieldLabel>Data de fundação</FieldLabel>
              <Controller
                name="foundationDate"
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
              <FieldLabel>Atividade empresarial</FieldLabel>
              <Controller
                control={control}
                name="businessActivity"
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      placeholder='Ex: Comércio varejista'
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(formatTitleCase(event.target.value))
                      }
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                    <FieldError error={fieldState.error} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>
        </div>
      </div>
    </div>
  )
}
