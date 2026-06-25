import type { AttachmentRecord, AttachmentSummary } from "./attachment";
import type { SupplementListItem } from "./supplement";

export const BOND_TYPE_REMITTANCE = "汇款";
export const BOND_TYPE_GUARANTEE = "保函";
export const WARRANTY_BOND_TYPE_RESERVE = "合同内金额预留";

export type RefundableBondType = typeof BOND_TYPE_REMITTANCE | typeof BOND_TYPE_GUARANTEE;
export type WarrantyBondType = RefundableBondType | typeof WARRANTY_BOND_TYPE_RESERVE;

export interface ContactRecord {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  position?: string | null;
}

export interface PaymentRecord {
  id?: string | null;
  amount: number;
  paidAt: string;
}

export interface CommissionRecord {
  id?: string | null;
  salesperson: string;
  commissionAmount: number;
  commissionPaidAt?: string | null;
}

export interface ContractInput {
  id?: string | null;
  contractDate: string;
  projectName: string;
  ownerUnit: string;
  contractAmount: number;
  performanceBondEnabled: boolean;
  performanceBondAmount?: number | null;
  performanceBondType?: string | null;
  performanceBondReturnDueAt?: string | null;
  performanceBondReturned: boolean;
  prepaymentEnabled: boolean;
  prepaymentAmount?: number | null;
  prepaymentType?: string | null;
  warrantyBondEnabled: boolean;
  warrantyBondAmount?: number | null;
  warrantyBondType?: string | null;
  warrantyBondReservePercent?: number | null;
  warrantyBondReturnDueAt?: string | null;
  warrantyBondReturned: boolean;
}

export interface ContractPayload {
  contract: ContractInput;
  contacts: ContactRecord[];
  payments: PaymentRecord[];
  commissions: CommissionRecord[];
}

export interface ContractListItem extends Omit<ContractInput, "id"> {
  id: string;
  paidAmount: number;
  unpaidAmount: number;
  supplementCount: number;
  attachmentSummary: AttachmentSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ContractListQuery {
  page: number;
  pageSize: number;
  contractDateStart?: string;
  contractDateEnd?: string;
  projectName?: string;
  ownerUnit?: string;
  salesperson?: string;
  performanceBondReturned?: boolean;
  warrantyBondReturned?: boolean;
  paymentSettled?: boolean;
}

export interface ContractListResult {
  items: ContractListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: ContractListSummary;
}

export interface ContractListSummary {
  contractAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  performanceBondUnreturnedAmount: number;
  warrantyBondUnreturnedAmount: number;
}

export interface ContractDetail extends ContractListItem {
  contacts: ContactRecord[];
  payments: PaymentRecord[];
  commissions: CommissionRecord[];
  attachments: AttachmentRecord[];
  supplements: SupplementListItem[];
  totalAmount: number;
}
