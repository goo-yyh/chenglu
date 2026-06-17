export type AttachmentBizType = "contract" | "contract_supplement";

export type AttachmentCategory =
  | "contract_file"
  | "award_notice"
  | "acceptance_report"
  | "invoice"
  | "supplement_file";

export const CONTRACT_ATTACHMENT_GROUPS: Array<{
  category: AttachmentCategory;
  label: string;
  maxCount?: number;
}> = [
  { category: "contract_file", label: "合同附件", maxCount: 1 },
  { category: "award_notice", label: "中标通知书", maxCount: 1 },
  { category: "acceptance_report", label: "验收报告", maxCount: 1 },
  { category: "invoice", label: "发票" },
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
