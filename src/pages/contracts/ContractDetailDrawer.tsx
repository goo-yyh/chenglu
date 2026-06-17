import { App, Descriptions, Drawer, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";
import AttachmentList from "../../components/AttachmentList";
import MoneyText from "../../components/MoneyText";
import { getContractDetail } from "../../services/contractApi";
import type {
  CommissionRecord,
  ContactRecord,
  ContractDetail,
  PaymentRecord,
} from "../../types/contract";
import { CONTRACT_ATTACHMENT_GROUPS } from "../../types/attachment";
import type { SupplementListItem } from "../../types/supplement";
import { getErrorMessage } from "../../utils/errors";

interface ContractDetailDrawerProps {
  open: boolean;
  contractId?: string;
  onClose: () => void;
}

export default function ContractDetailDrawer({
  open,
  contractId,
  onClose,
}: ContractDetailDrawerProps) {
  const { message } = App.useApp();
  const [detail, setDetail] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !contractId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getContractDetail(contractId)
      .then(setDetail)
      .catch((error) => {
        message.error(getErrorMessage(error, "合同详情加载失败"));
      })
      .finally(() => setLoading(false));
  }, [open, contractId, message]);

  const contactColumns: ColumnsType<ContactRecord> = [
    { title: "经办人姓名", dataIndex: "name" },
    { title: "经办人电话", dataIndex: "phone" },
    { title: "经办人职位", dataIndex: "position" },
  ];

  const paymentColumns: ColumnsType<PaymentRecord> = [
    {
      title: "收款金额（万元）",
      dataIndex: "amount",
      render: (value) => <MoneyText value={value} />,
    },
    { title: "收款日期", dataIndex: "paidAt" },
  ];

  const commissionColumns: ColumnsType<CommissionRecord> = [
    { title: "业务员", dataIndex: "salesperson" },
    {
      title: "提成（万元）",
      dataIndex: "commissionAmount",
      render: (value) => <MoneyText value={value} />,
    },
    { title: "提成付款时间", dataIndex: "commissionPaidAt" },
  ];

  const supplementColumns: ColumnsType<SupplementListItem> = [
    {
      title: "增加合同金额（万元）",
      dataIndex: "supplementAmount",
      render: (value) => <MoneyText value={value} />,
    },
    { title: "增补合同日期", dataIndex: "supplementDate" },
    {
      title: "增补合同收款金额（万元）",
      dataIndex: "paidAmount",
      render: (value) => <MoneyText value={value} />,
    },
    {
      title: "未收款金额（万元）",
      dataIndex: "unpaidAmount",
      render: (value) => <MoneyText value={value} />,
    },
  ];

  return (
    <Drawer title="合同详情" open={open} onClose={onClose} width={920} loading={loading}>
      {detail && (
        <>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="时间">{detail.contractDate}</Descriptions.Item>
            <Descriptions.Item label="项目名称">{detail.projectName}</Descriptions.Item>
            <Descriptions.Item label="业主单位">{detail.ownerUnit}</Descriptions.Item>
            <Descriptions.Item label="合同金额（万元）">
              <MoneyText value={detail.contractAmount} />
            </Descriptions.Item>
            <Descriptions.Item label="初始合同已收款（万元）">
              <MoneyText value={detail.paidAmount} />
            </Descriptions.Item>
            <Descriptions.Item label="初始合同未收款（万元）">
              <MoneyText value={detail.unpaidAmount} />
            </Descriptions.Item>
            <Descriptions.Item label="总合同金额（万元）">
              <MoneyText value={detail.totalAmount} />
            </Descriptions.Item>
            <Descriptions.Item label="合同附件">
              {detail.attachmentSummary.count > 0 ? (
                <Tag color="blue">{detail.attachmentSummary.count} 个附件</Tag>
              ) : (
                <Tag>无附件</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          <div className="form-section" style={{ marginTop: 18 }}>
            <Typography.Title level={5}>履约保证金</Typography.Title>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="是否有履约保证金">
                {detail.performanceBondEnabled ? "是" : "否"}
              </Descriptions.Item>
              <Descriptions.Item label="履约保证金（万元）">
                {detail.performanceBondEnabled ? (
                  <MoneyText value={detail.performanceBondAmount} />
                ) : (
                  "无"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="履约保证金形式">
                {detail.performanceBondType || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="约定退还时间">
                {detail.performanceBondReturnDueAt || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="是否已经退还">
                {detail.performanceBondReturned ? "已退还" : "未退还"}
              </Descriptions.Item>
            </Descriptions>
          </div>

          <div className="form-section">
            <Typography.Title level={5}>质保金</Typography.Title>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="是否有质保金">
                {detail.warrantyBondEnabled ? "是" : "否"}
              </Descriptions.Item>
              <Descriptions.Item label="质保金（万元）">
                {detail.warrantyBondEnabled ? (
                  <MoneyText value={detail.warrantyBondAmount} />
                ) : (
                  "无"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="质保金形式">
                {detail.warrantyBondType || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="约定退还时间">
                {detail.warrantyBondReturnDueAt || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="是否已经退还">
                {detail.warrantyBondReturned ? "已退还" : "未退还"}
              </Descriptions.Item>
            </Descriptions>
          </div>

          <div className="form-section">
            <Typography.Title level={5}>经办人</Typography.Title>
            <Table
              rowKey={(row) => row.id || `${row.name}-${row.phone}`}
              columns={contactColumns}
              dataSource={detail.contacts}
              pagination={false}
              size="small"
            />
          </div>

          <div className="form-section">
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
            <Typography.Title level={5}>业务员提成</Typography.Title>
            <Table
              rowKey={(row) => row.id || `${row.salesperson}-${row.commissionAmount}`}
              columns={commissionColumns}
              dataSource={detail.commissions}
              pagination={false}
              size="small"
            />
          </div>

          <div className="form-section">
            <Typography.Title level={5}>合同附件</Typography.Title>
            <div className="attachment-grid">
              {CONTRACT_ATTACHMENT_GROUPS.map((group) => (
                <div className="attachment-group" key={group.category}>
                  <Typography.Text className="attachment-group-title" type="secondary">
                    {group.label}
                  </Typography.Text>
                  <AttachmentList
                    bizType="contract"
                    bizId={detail.id}
                    category={group.category}
                    readonly
                    compact
                    maxCount={group.maxCount}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <Typography.Title level={5}>增补合同</Typography.Title>
            <Table
              rowKey="id"
              columns={supplementColumns}
              dataSource={detail.supplements}
              pagination={false}
              size="small"
            />
          </div>
        </>
      )}
    </Drawer>
  );
}
