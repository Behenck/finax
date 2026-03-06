import z from "zod";

export const employeePixKeyTypeSchema = z.enum([
	"CPF",
	"CNPJ",
	"EMAIL",
	"PHONE",
	"RANDOM",
]);

export const employeeSchema = z.object({
	name: z.string({ error: "Defina o nome do funcionário" }),
	role: z.string().optional(),
	email: z.email({ error: "Defina o email do funcionário" }),
	phone: z.string().optional(),
	department: z.string().optional(),
	cpf: z.string().optional(),
	pixKeyType: employeePixKeyTypeSchema.optional(),
	pixKey: z.string().optional(),
	paymentNotes: z.string().optional(),
	country: z.string().optional(),
	state: z.string().optional(),
	city: z.string().optional(),
	street: z.string().optional(),
	zipCode: z.string().optional(),
	neighborhood: z.string().optional(),
	number: z.string().optional(),
	complement: z.string().optional(),
	companyId: z.uuid({ error: "Selecione uma empresa" }),
	unitId: z.uuid().optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;
