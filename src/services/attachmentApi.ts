import { open } from "@tauri-apps/plugin-dialog";
import type {
  AttachmentAcceptKind,
  AttachmentBizType,
  AttachmentCategory,
  AttachmentRecord,
} from "../types/attachment";
import {
  mockAddAttachment,
  mockDeleteAttachment,
  mockListAttachments,
} from "./mockStore";
import { invokeOrMock, isTauriRuntime } from "./tauri";

const ATTACHMENT_FILTERS: Record<
  AttachmentAcceptKind,
  { title: string; name: string; extensions: string[] }
> = {
  documents: {
    title: "选择附件",
    name: "Word、Excel、PDF 文件",
    extensions: ["doc", "docx", "xls", "xlsx", "pdf"],
  },
  remittanceVoucher: {
    title: "选择汇款凭证",
    name: "图片或 PDF 文件",
    extensions: ["jpg", "jpeg", "png", "pdf"],
  },
  pdf: {
    title: "选择 PDF 附件",
    name: "PDF 文件",
    extensions: ["pdf"],
  },
};

export async function pickSourcePaths(acceptKind: AttachmentAcceptKind = "documents") {
  if (!isTauriRuntime()) {
    return [];
  }
  const filter = ATTACHMENT_FILTERS[acceptKind];
  const selected = await open({
    multiple: true,
    directory: false,
    title: filter.title,
    filters: [
      {
        name: filter.name,
        extensions: filter.extensions,
      },
    ],
  });
  if (!selected) {
    return [];
  }
  return Array.isArray(selected) ? selected : [selected];
}

export function addAttachment(
  bizType: AttachmentBizType,
  bizId: string,
  category: AttachmentCategory,
  sourcePath: string,
) {
  return invokeOrMock<AttachmentRecord>(
    "add_attachment",
    { bizType, bizId, category, sourcePath },
    () => mockAddAttachment(bizType, bizId, category, sourcePath),
  );
}

export function listAttachments(
  bizType: AttachmentBizType,
  bizId: string,
  category: AttachmentCategory,
) {
  return invokeOrMock<AttachmentRecord[]>(
    "list_attachments",
    { bizType, bizId, category },
    () => mockListAttachments(bizType, bizId, category),
  );
}

export function openAttachment(attachmentId: string) {
  return invokeOrMock<void>("open_attachment", { attachmentId }, () => {
    return undefined;
  });
}

export function deleteAttachment(attachmentId: string) {
  return invokeOrMock<void>(
    "delete_attachment",
    { attachmentId },
    () => mockDeleteAttachment(attachmentId),
  );
}
