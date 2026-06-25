import { App, Descriptions, Drawer, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import AttachmentList from "../../components/AttachmentList";
import MoneyText from "../../components/MoneyText";
import { getContractSupplementDetail } from "../../services/supplementApi";
import type { PaymentRecord } from "../../types/contract";
import type { SupplementDetail } from "../../types/supplement";
import { getErrorMessage } from "../../utils/errors";

interface SupplementDetailDrawerProps {
  open: boolean;
  supplementId?: string;
  onClose: () => void;
}

export default function SupplementDetailDrawer({
  open,
  supplementId,
  onClose,
}: SupplementDetailDrawerProps) {
  const { message } = App.useApp();
  const [detail, setDetail] = useState<SupplementDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !supplementId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getContractSupplementDetail(supplementId)
      .then(setDetail)
      .catch((error) => {
        message.error(getErrorMessage(error, "增补合同详情加载失败"));
      })
      .finally(() => setLoading(false));
  }, [open, supplementId, message]);

  const paymentColumns: ColumnsType<PaymentRecord> = [
    {
      title: "收款金额（元）",
      dataIndex: "amount",
      render: (value) => <MoneyText value={value} />,
    },
    {
      title: "收款日期",
      dataIndex: "paidAt",
    },
  ];

  return (
    <Drawer title="增补合同详情" open={open} onClose={onClose} width={620} loading={loading}>
      {detail && (
        <>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="增加合同金额（元）">
              <MoneyText value={detail.supplementAmount} />
            </Descriptions.Item>
            <Descriptions.Item label="增补合同日期">
              {detail.supplementDate}
            </Descriptions.Item>
            <Descriptions.Item label="增补合同收款金额（元）">
              <MoneyText value={detail.paidAmount} />
            </Descriptions.Item>
            <Descriptions.Item label="未收款金额（元）">
              <MoneyText value={detail.unpaidAmount} />
            </Descriptions.Item>
            <Descriptions.Item label="附件">
              {detail.attachmentSummary.count > 0 ? (
                <Tag color="blue">{detail.attachmentSummary.count} 个附件</Tag>
              ) : (
                <Tag>无附件</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          <div className="form-section" style={{ marginTop: 18 }}>
            <Typography.Title level={5}>收款记录</Typography.Title>
            <Table
              rowKey={(row) => row.id || `${row.amount}-${row.paidAt}`}
              columns={paymentColumns}
              dataSource={detail.payments}
              pagination={false}
              size="small"
            />
          </div>

          <div className="form-section">
            <Typography.Title level={5}>增补合同附件</Typography.Title>
            <AttachmentList
              bizType="contract_supplement"
              bizId={detail.id}
              category="supplement_file"
              acceptKind="documents"
              readonly
              compact
            />
          </div>
        </>
      )}
    </Drawer>
  );
}
