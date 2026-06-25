import {
  Button,
  DatePicker,
  Drawer,
  Form,
  InputNumber,
  Space,
  Table,
  Typography,
  App,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AttachmentList from "../../components/AttachmentList";
import MoneyText from "../../components/MoneyText";
import {
  createContractSupplement,
  getContractSupplementDetail,
  updateContractSupplement,
} from "../../services/supplementApi";
import type { PaymentRecord } from "../../types/contract";
import { toDateString, toDayjs } from "../../utils/date";
import { getErrorMessage } from "../../utils/errors";

interface PaymentRow {
  key: string;
  id?: string | null;
  amount?: number | null;
  paidAt?: string | null;
}

interface SupplementFormValues {
  supplementAmount?: number | null;
  supplementDate: Dayjs;
}

interface SupplementFormDrawerProps {
  open: boolean;
  contractId?: string;
  supplementId?: string;
  onClose: () => void;
  onSaved: () => void;
}

function ReadonlyText({ value }: { value?: string | null }) {
  return <Typography.Text>{value || "-"}</Typography.Text>;
}

function ReadonlyMoney({ value }: { value?: number | null }) {
  if (value === undefined || value === null) {
    return <Typography.Text>-</Typography.Text>;
  }
  return <MoneyText value={value} />;
}

export default function SupplementFormDrawer({
  open,
  contractId,
  supplementId,
  onClose,
  onSaved,
}: SupplementFormDrawerProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<SupplementFormValues>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [editingPaymentKeys, setEditingPaymentKeys] = useState<Set<string>>(new Set());
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentRow>>({});
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const editing = Boolean(supplementId);
  const attachmentBizId = supplementId || draftId;

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!editing) {
      const id = crypto.randomUUID();
      setDraftId(id);
      setPayments([]);
      setEditingPaymentKeys(new Set());
      setPaymentDrafts({});
      form.setFieldsValue({
        supplementAmount: undefined,
        supplementDate: dayjs(),
      });
      return;
    }
    setLoading(true);
    getContractSupplementDetail(supplementId!)
      .then((detail) => {
        form.setFieldsValue({
          supplementAmount: detail.supplementAmount,
          supplementDate: toDayjs(detail.supplementDate) || dayjs(),
        });
        setPayments(
          detail.payments.map((item) => ({
            key: item.id || crypto.randomUUID(),
            id: item.id,
            amount: item.amount,
            paidAt: item.paidAt,
          })),
        );
        setEditingPaymentKeys(new Set());
        setPaymentDrafts({});
      })
      .catch((error) => {
        message.error(getErrorMessage(error, "增补合同详情加载失败"));
      })
      .finally(() => setLoading(false));
  }, [open, editing, supplementId, form, message]);

  function removePayment(key: string) {
    setPayments((rows) => rows.filter((row) => row.key !== key));
    clearPaymentEdit(key);
  }

  function addPayment() {
    const key = crypto.randomUUID();
    const row = { key, amount: 0, paidAt: dayjs().format("YYYY-MM-DD") };
    setPayments((rows) => [...rows, row]);
    setEditingPaymentKeys((keys) => new Set(keys).add(key));
    setPaymentDrafts((drafts) => ({ ...drafts, [key]: row }));
  }

  function beginPaymentEdit(row: PaymentRow) {
    setEditingPaymentKeys((keys) => new Set(keys).add(row.key));
    setPaymentDrafts((drafts) => ({ ...drafts, [row.key]: { ...row } }));
  }

  function updatePaymentDraft(key: string, patch: Partial<PaymentRow>) {
    setPaymentDrafts((drafts) => ({
      ...drafts,
      [key]: { ...(drafts[key] || payments.find((row) => row.key === key) || { key }), ...patch },
    }));
  }

  function clearPaymentEdit(key: string) {
    setEditingPaymentKeys((keys) => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
    setPaymentDrafts((drafts) => {
      const next = { ...drafts };
      delete next[key];
      return next;
    });
  }

  function savePaymentRow(key: string) {
    const draft = paymentDrafts[key] || payments.find((row) => row.key === key);
    if (!draft) {
      return;
    }
    const hasValue = Number(draft.amount || 0) > 0 || Boolean(draft.paidAt);
    if (hasValue && !draft.paidAt) {
      message.error("增补合同收款记录需要同时填写金额和收款日期");
      return;
    }
    setPayments((rows) => rows.map((row) => (row.key === key ? { ...row, ...draft } : row)));
    clearPaymentEdit(key);
  }

  function hasUnsavedPaymentDrafts() {
    return Object.values(paymentDrafts).some(
      (row) => Number(row.amount || 0) > 0 || row.paidAt,
    );
  }

  const paymentColumns = useMemo<ColumnsType<PaymentRow>>(
    () => [
      {
        title: "收款金额（元）",
        dataIndex: "amount",
        width: 180,
        render: (_, row) => {
          const editingRow = editingPaymentKeys.has(row.key);
          const value = editingRow ? paymentDrafts[row.key] || row : row;
          if (!editingRow) {
            return <ReadonlyMoney value={value.amount} />;
          }
          return (
            <InputNumber
              min={0}
              precision={2}
              value={value.amount}
              suffix="元"
              style={{ width: "100%" }}
              onChange={(amount) => updatePaymentDraft(row.key, { amount })}
            />
          );
        },
      },
      {
        title: "收款日期",
        dataIndex: "paidAt",
        width: 180,
        render: (_, row) => {
          const editingRow = editingPaymentKeys.has(row.key);
          const value = editingRow ? paymentDrafts[row.key] || row : row;
          if (!editingRow) {
            return <ReadonlyText value={value.paidAt} />;
          }
          return (
            <DatePicker
              value={toDayjs(value.paidAt)}
              style={{ width: "100%" }}
              onChange={(paidAt) => updatePaymentDraft(row.key, { paidAt: toDateString(paidAt) })}
            />
          );
        },
      },
      {
        title: "操作",
        width: 210,
        render: (_, row) => {
          const editingRow = editingPaymentKeys.has(row.key);
          return (
            <Space size={4}>
              <Button danger type="link" icon={<Trash2 size={15} />} onClick={() => removePayment(row.key)}>
                删除
              </Button>
              <Button
                type="link"
                icon={<Pencil size={15} />}
                disabled={editingRow}
                onClick={() => beginPaymentEdit(row)}
              >
                编辑
              </Button>
              <Button
                type="link"
                icon={<Save size={15} />}
                disabled={!editingRow}
                onClick={() => savePaymentRow(row.key)}
              >
                保存
              </Button>
            </Space>
          );
        },
      },
    ],
    [editingPaymentKeys, paymentDrafts, payments],
  );

  async function handleFinish(values: SupplementFormValues) {
    if (hasUnsavedPaymentDrafts()) {
      message.error("请先保存正在编辑的表格行");
      return;
    }

    const normalizedPayments: PaymentRecord[] = payments
      .filter((row) => Number(row.amount || 0) > 0 || row.paidAt)
      .map((row) => ({
        id: row.id,
        amount: Number(row.amount || 0),
        paidAt: row.paidAt || "",
      }));
    const invalidPayment = normalizedPayments.some(
      (row) => row.amount < 0 || !row.paidAt,
    );
    if (invalidPayment) {
      message.error("增补合同收款记录需要同时填写金额和收款日期");
      return;
    }
    if (!contractId && !editing) {
      message.error("缺少主合同 ID");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplement: {
          id: editing ? supplementId : draftId,
          supplementAmount: Number(values.supplementAmount || 0),
          supplementDate: toDateString(values.supplementDate),
        },
        payments: normalizedPayments,
      };
      if (editing) {
        await updateContractSupplement(supplementId!, payload);
      } else {
        await createContractSupplement(contractId!, payload);
      }
      message.success(editing ? "增补合同已更新" : "增补合同已添加");
      onSaved();
      onClose();
    } catch (error) {
      message.error(getErrorMessage(error, editing ? "增补合同更新失败" : "增补合同添加失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title={editing ? "编辑增补合同" : "添加增补合同"}
      open={open}
      onClose={onClose}
      width={620}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={() => form.submit()}>
            保存
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleFinish}
        onFinishFailed={() => message.error("请填写必填项")}
        disabled={loading}
      >
        <div className="form-section">
          <div className="form-section-title">基础信息</div>
          <Form.Item
            label="增加合同金额（元）"
            name="supplementAmount"
            rules={[{ required: true, message: "请输入增加合同金额" }]}
          >
            <InputNumber min={0} precision={2} suffix="元" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="增补合同日期"
            name="supplementDate"
            rules={[{ required: true, message: "请选择增补合同日期" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <div className="attachment-field">
            <Typography.Text type="secondary">增补合同附件</Typography.Text>
            <AttachmentList
              bizType="contract_supplement"
              bizId={attachmentBizId}
              category="supplement_file"
              acceptKind="documents"
              compact
            />
          </div>
        </div>

        <div className="form-section">
          <Space className="section-toolbar">
            <div className="form-section-title">增补合同收款记录</div>
            <Button icon={<Plus size={15} />} onClick={addPayment}>
              添加收款
            </Button>
          </Space>
          <Table
            className="inline-edit-table"
            rowKey="key"
            columns={paymentColumns}
            dataSource={payments}
            pagination={false}
            size="small"
          />
        </div>
      </Form>
    </Drawer>
  );
}
