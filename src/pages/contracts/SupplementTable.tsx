import { App, Button, Popconfirm, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import MoneyText from "../../components/MoneyText";
import { deleteContractSupplement, listContractSupplements } from "../../services/supplementApi";
import type { SupplementListItem } from "../../types/supplement";
import { getErrorMessage } from "../../utils/errors";

interface SupplementTableProps {
  contractId: string;
  refreshKey: number;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onChanged: () => void;
}

export default function SupplementTable({
  contractId,
  refreshKey,
  onEdit,
  onView,
  onChanged,
}: SupplementTableProps) {
  const { message } = App.useApp();
  const [rows, setRows] = useState<SupplementListItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await listContractSupplements(contractId));
    } catch (error) {
      message.error(getErrorMessage(error, "增补合同列表加载失败"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [contractId, refreshKey]);

  async function handleDelete(id: string) {
    try {
      await deleteContractSupplement(id);
      message.success("增补合同已删除");
      await load();
      onChanged();
    } catch (error) {
      message.error(getErrorMessage(error, "增补合同删除失败"));
    }
  }

  const columns: ColumnsType<SupplementListItem> = [
    {
      title: "增加合同金额（元）",
      dataIndex: "supplementAmount",
      width: "18%",
      render: (value) => <MoneyText value={value} />,
    },
    {
      title: "增补合同日期",
      dataIndex: "supplementDate",
      width: "14%",
    },
    {
      title: "增补合同附件",
      dataIndex: "attachmentSummary",
      width: "14%",
      render: (_, row) =>
        row.attachmentSummary.count > 0 ? (
          <Tag color="blue">{row.attachmentSummary.count} 个附件</Tag>
        ) : (
          <Tag>无附件</Tag>
        ),
    },
    {
      title: "增补合同收款金额（元）",
      dataIndex: "paidAmount",
      width: "18%",
      render: (value) => <MoneyText value={value} />,
    },
    {
      title: "未收款金额（元）",
      dataIndex: "unpaidAmount",
      width: "16%",
      render: (value) => <MoneyText value={value} />,
    },
    {
      title: "操作",
      width: "20%",
      render: (_, row) => (
        <Space className="table-action-cell supplement-action-cell" size={4}>
          <Button type="link" size="small" icon={<Pencil size={15} />} onClick={() => onEdit(row.id)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<Eye size={15} />} onClick={() => onView(row.id)}>
            查看详情
          </Button>
          <Popconfirm
            title="删除增补合同"
            description="确定删除这条增补合同吗？"
            onConfirm={() => handleDelete(row.id)}
          >
            <Button danger type="link" size="small" icon={<Trash2 size={15} />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table
      className="expanded-table"
      rowKey="id"
      loading={loading}
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="small"
      tableLayout="fixed"
      locale={{ emptyText: "暂无增补合同" }}
    />
  );
}
