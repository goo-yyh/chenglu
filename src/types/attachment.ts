export type AttachmentBizType = "contract" | "contract_supplement";

export type AttachmentCategory =
  | "contract_file"
  | "award_notice"
  | "tender_file"
  | "bid_file"
  | "acceptance_report"
  | "invoice"
  | "performance_remittance_voucher"
  | "performance_guarantee_voucher"
  | "prepayment_remittance_voucher"
  | "prepayment_guarantee_voucher"
  | "warranty_remittance_voucher"
  | "warranty_guarantee_voucher"
  | "supplement_file";

export type AttachmentAcceptKind = "documents" | "remittanceVoucher" | "pdf";

export const CONTRACT_ATTACHMENT_GROUPS: Array<{
  category: AttachmentCategory;
  label: string;
  acceptKind: AttachmentAcceptKind;
}> = [
  { category: "contract_file", label: "合同附件", acceptKind: "documents" },
  { category: "award_notice", label: "中标通知书", acceptKind: "documents" },
  { category: "tender_file", label: "招标文件", acceptKind: "documents" },
  { category: "bid_file", label: "投标文件", acceptKind: "documents" },
  { category: "acceptance_report", label: "验收资料", acceptKind: "documents" },
  { category: "invoice", label: "发票", acceptKind: "documents" },
];

export interface AttachmentSummary {
  count: number;
  names: string[];
}

export interface AttachmentRecord {
  id: string;
  bizType: AttachmentBizType;
  bizId: string;
  category: AttachmentCategory;
  originalFileName: string;
  storedFileName: string;
  relativePath: string;
  mimeType?: string | null;
  fileSize?: number | null;
  sha256?: string | null;
  createdAt: string;
}
