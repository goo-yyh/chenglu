import { App, Button, List, Popconfirm, Space, Tag, Typography } from "antd";
import { FileText, FolderOpen, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AttachmentAcceptKind,
  AttachmentBizType,
  AttachmentCategory,
  AttachmentRecord,
} from "../types/attachment";
import {
  addAttachment,
  deleteAttachment,
  listAttachments,
  openAttachment,
  pickSourcePaths,
} from "../services/attachmentApi";
import { isTauriRuntime } from "../services/tauri";
import { getErrorMessage } from "../utils/errors";

interface AttachmentListProps {
  bizType: AttachmentBizType;
  bizId: string;
  category: AttachmentCategory;
  acceptKind?: AttachmentAcceptKind;
  buttonText?: string;
  maxCount?: number;
  readonly?: boolean;
  compact?: boolean;
  onChanged?: () => void;
}

export default function AttachmentList({
  bizType,
  bizId,
  category,
  acceptKind = "documents",
  buttonText,
  maxCount,
  readonly,
  compact,
  onChanged,
}: AttachmentListProps) {
  const { message } = App.useApp();
  const [items, setItems] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!bizId) {
      setItems([]);
      return;
    }
    try {
      setItems(await listAttachments(bizType, bizId, category));
    } catch (error) {
      message.error(getErrorMessage(error, "附件列表加载失败"));
    }
  }

  useEffect(() => {
    void load();
  }, [bizType, bizId, category]);

  async function handleAdd() {
    try {
      const remainingCount = maxCount === undefined ? undefined : maxCount - items.length;
      if (remainingCount !== undefined && remainingCount <= 0) {
        message.warning("该附件类型已达到上传数量限制，请先删除后再上传");
        return;
      }
      const paths = await pickSourcePaths(acceptKind);
      if (paths.length === 0) {
        if (!isTauriRuntime()) {
          message.info("浏览器预览模式不能读取本地文件路径，请在 Tauri 桌面应用中添加附件");
        }
        return;
      }
      if (remainingCount !== undefined && paths.length > remainingCount) {
        message.warning("该附件类型已达到上传数量限制，请先删除后再上传");
        return;
      }
      setLoading(true);
      for (const path of paths) {
        await addAttachment(bizType, bizId, category, path);
      }
      await load();
      onChanged?.();
      message.success("附件已添加");
    } catch (error) {
      message.error(getErrorMessage(error, "附件添加失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAttachment(id);
      await load();
      onChanged?.();
      message.success("附件已删除");
    } catch (error) {
      message.error(getErrorMessage(error, "附件删除失败"));
    }
  }

  async function handleOpen(id: string) {
    try {
      await openAttachment(id);
    } catch (error) {
      message.error(getErrorMessage(error, "附件打开失败"));
    }
  }

  const addDisabled = maxCount !== undefined && items.length >= maxCount;

  return (
    <div className="attachment-list">
      {!readonly && (
        <Button
          disabled={addDisabled}
          icon={<Upload size={16} />}
          loading={loading}
          onClick={handleAdd}
          size={compact ? "small" : "middle"}
        >
          {buttonText || "添加附件"}
        </Button>
      )}
      <List
        size="small"
        dataSource={items}
        locale={{ emptyText: "暂无附件" }}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button
                key="open"
                type="link"
                size="small"
                icon={<FolderOpen size={15} />}
                onClick={() => handleOpen(item.id)}
              >
                打开
              </Button>,
              !readonly && (
                <Popconfirm
                  key="delete"
                  title="删除附件"
                  description="确定删除这个附件吗？"
                  onConfirm={() => handleDelete(item.id)}
                >
                  <Button danger type="link" size="small" icon={<Trash2 size={15} />}>
                    删除
                  </Button>
                </Popconfirm>
              ),
            ].filter(Boolean)}
          >
            <Space>
              <FileText size={16} />
              <Typography.Text>{item.originalFileName}</Typography.Text>
              {item.fileSize ? <Tag>{Math.ceil(item.fileSize / 1024)} KB</Tag> : null}
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
}
