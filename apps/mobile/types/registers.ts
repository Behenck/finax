export type CustomerPersonType = "PF" | "PJ";
export type CustomerDocumentType =
  | "CPF"
  | "CNPJ"
  | "RG"
  | "IE"
  | "PASSPORT"
  | "OTHER";
export type CustomerStatus = "ACTIVE" | "INACTIVE";
export type CustomerResponsibleType = "SELLER" | "PARTNER";

export type CustomerResponsible = {
  type: CustomerResponsibleType;
  id: string;
  name: string;
};

export type CustomerPfData = {
  birthDate: string | null;
  monthlyIncome: number | null;
  profession: string | null;
  placeOfBirth: string | null;
  fatherName: string | null;
  motherName: string | null;
  naturality: string | null;
};

export type CustomerPjData = {
  businessActivity: string | null;
  municipalRegistration: string | null;
  stateRegistration: string | null;
  legalName: string | null;
  tradeName: string | null;
  foundationDate: string | null;
};

export type Customer = {
  id: string;
  name: string;
  personType: CustomerPersonType;
  phone: string | null;
  email: string | null;
  documentType: CustomerDocumentType;
  documentNumber: string;
  status: CustomerStatus;
  responsible: CustomerResponsible | null;
  pf: CustomerPfData | null;
  pj: CustomerPjData | null;
};

export type CustomerInput = {
  name: string;
  personType: CustomerPersonType;
  phone?: string;
  email?: string;
  documentType: CustomerDocumentType;
  documentNumber: string;
  responsible?: {
    type: CustomerResponsibleType;
    id: string;
  } | null;
  pf?: {
    birthDate?: string;
    monthlyIncome?: number;
    profession?: string;
    placeOfBirth?: string;
    fatherName?: string;
    motherName?: string;
    naturality?: string;
  };
  pj?: {
    businessActivity?: string;
    municipalRegistration?: string;
    stateRegistration?: string;
    legalName?: string;
    tradeName?: string;
    foundationDate?: string;
  };
};

export type SellerDocumentType = "CPF" | "CNPJ";
export type SellerStatus = "ACTIVE" | "INACTIVE";

export type Seller = {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  documentType: SellerDocumentType;
  document: string;
  country: string;
  state: string;
  city: string | null;
  street: string | null;
  zipCode: string | null;
  neighborhood: string | null;
  number: string | null;
  complement: string | null;
  status: SellerStatus;
  user: {
    id: string;
    name: string | null;
  } | null;
};

export type SellerInput = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  documentType: SellerDocumentType;
  document: string;
  country: string;
  state: string;
  city?: string;
  street?: string;
  zipCode?: string;
  neighborhood?: string;
  number?: string;
  complement?: string;
  status?: SellerStatus;
};

export type PartnerDocumentType = "CPF" | "CNPJ";
export type PartnerStatus = "ACTIVE" | "INACTIVE";

export type Partner = {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  documentType: PartnerDocumentType;
  document: string;
  country: string;
  state: string;
  city: string | null;
  street: string | null;
  zipCode: string | null;
  neighborhood: string | null;
  number: string | null;
  complement: string | null;
  status: PartnerStatus;
  user: {
    id: string;
    name: string | null;
  } | null;
  supervisor: {
    id: string;
    name: string | null;
  } | null;
};

export type PartnerInput = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  documentType: PartnerDocumentType;
  document: string;
  country: string;
  state: string;
  city?: string;
  street?: string;
  zipCode?: string;
  neighborhood?: string;
  number?: string;
  complement?: string;
  status?: PartnerStatus;
  supervisorId?: string;
};

export type ProductNode = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  children: ProductNode[];
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductInput = {
  name: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type Unit = {
  id: string;
  name: string;
  country: string | null;
  state: string | null;
  city: string | null;
  street: string | null;
  zipCode: string | null;
  neighborhood: string | null;
  number: string | null;
  complement: string | null;
};

export type UnitInput = {
  name: string;
  country?: string;
  state?: string;
  city?: string;
  street?: string;
  zipCode?: string;
  neighborhood?: string;
  number?: string;
  complement?: string;
};

export type Company = {
  id: string;
  name: string;
  units: Unit[];
  employees: {
    id: string;
    name: string;
    department: string | null;
  }[];
};

export type CategoryType = "INCOME" | "OUTCOME";

export type CategoryChild = {
  id: string;
  name: string;
  code: string | null;
  type: CategoryType;
  color: string;
  icon: string;
  parentId: string;
};

export type Category = {
  id: string;
  name: string;
  code: string | null;
  type: CategoryType;
  color: string;
  icon: string;
  parentId: null;
  children: CategoryChild[];
};

export type CategoryInput = {
  name: string;
  code?: string;
  type: CategoryType;
  icon: string;
  parentId?: string;
  color: string;
};

export type CostCenter = {
  id: string;
  name: string;
};

export type EmployeePixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

export type Employee = {
  id: string;
  name: string;
  role: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  cpf: string | null;
  pixKeyType: EmployeePixKeyType | null;
  pixKey: string | null;
  paymentNotes: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  street: string | null;
  zipCode: string | null;
  neighborhood: string | null;
  number: string | null;
  complement: string | null;
  userId: string | null;
  company: {
    id: string;
    name: string;
  };
  unit: {
    id: string;
    name: string;
  } | null;
};

export type EmployeeInput = {
  name: string;
  role?: string;
  email: string;
  phone?: string;
  department?: string;
  cpf?: string;
  pixKeyType?: EmployeePixKeyType;
  pixKey?: string;
  paymentNotes?: string;
  country?: string;
  state?: string;
  city?: string;
  street?: string;
  zipCode?: string;
  neighborhood?: string;
  number?: string;
  complement?: string;
  companyId: string;
  unitId?: string;
};
