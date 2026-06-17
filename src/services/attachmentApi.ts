import { open } from "@tauri-apps/plugin-dialog";
import type {
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

export async function pickSourcePaths() {
  if (!isTauriRuntime()) {
    return [];
  }
  const selected = await open({
    multiple: true,
    directory: false,
    title: "选择 PDF 附件",
    filters: [
      {
        name: "PDF 文件",
        extensions: ["pdf"],
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
