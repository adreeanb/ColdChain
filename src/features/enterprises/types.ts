export interface Enterprise {
  id: string
  name: string
  cnpj: string
  createdAt: string
}

export interface EnterpriseInput {
  name: string
  cnpj: string
}
