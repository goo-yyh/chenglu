import type { AttachmentRecord, AttachmentSummary } from "./attachment";
import type { PaymentRecord } from "./contract";

export interface SupplementInput {
  id?: string | null;
  supplementAmount: number;
  supplementDate: string;
}

export interface SupplementPayload {
  supplement: SupplementInput;
  payments: PaymentRecord[];
}

export interface SupplementListItem extends Omit<SupplementInput, "id"> {
  id: string;
  contractId: string;
  paidAmount: number;
  unpaidAmount: number;
  attachmentSummary: AttachmentSummary;
  createdAt: string;
  updatedAt: string;
}

export interface SupplementDetail extends SupplementListItem {
  payments: PaymentRecord[];
  attachments: AttachmentRecord[];
}
