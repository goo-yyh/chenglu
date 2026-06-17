import {
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Space,
  Switch,
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
  createContract,
  getContractDetail,
  updateContract,
} from "../../services/contractApi";
import type {
  CommissionRecord,
  ContactRecord,
  ContractPayload,
  PaymentRecord,
} from "../../types/contract";
import { CONTRACT_ATTACHMENT_GROUPS } from "../../types/attachment";
import { toDateString, toDayjs } from "../../utils/date";
import { getErrorMessage } from "../../utils/errors";

interface ContactRow {
  key: string;
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  position?: string | null;
}

interface PaymentRow {
  key: string;
  id?: string | null;
  amount?: number | null;
  paidAt?: string | null;
}

interface CommissionRow {
  key: string;
  id?: string | null;
  salesperson?: string | null;
  commissionAmount?: number | null;
  commissionPaidAt?: string | null;
}

interface ContractFormValues {
  contractDate: Dayjs;
  projectName: string;
  ownerUnit: string;
  contractAmount?: number | null;
  performanceBondEnabled: boolean;
  performanceBondAmount?: number | null;
  performanceBondType?: string | null;
  performanceBondReturnDueAt?: Dayjs | null;
  performanceBondReturned: boolean;
  warrantyBondEnabled: boolean;
  warrantyBondAmount?: number | null;
  warrantyBondType?: string | null;
  warrantyBondReturnDueAt?: Dayjs | null;
  warrantyBondReturned: boolean;
}

interface ContractFormDrawerProps {
  open: boolean;
  contractId?: string;
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

export default function ContractFormDrawer({
  open,
  contractId,
  onClose,
  onSaved,
}: ContractFormDrawerProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ContractFormValues>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [editingContactKeys, setEditingContactKeys] = useState<Set<string>>(new Set());
  const [editingPaymentKeys, setEditingPaymentKeys] = useState<Set<string>>(new Set());
  const [editingCommissionKeys, setEditingCommissionKeys] = useState<Set<string>>(new Set());
  const [contactDrafts, setContactDrafts] = useState<Record<string, ContactRow>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentRow>>({});
  const [commissionDrafts, setCommissionDrafts] = useState<Record<string, CommissionRow>>({});
  const editing = Boolean(contractId);
  const attachmentBizId = contractId || draftId;
  const performanceBondEnabled = Form.useWatch("performanceBondEnabled", form);
  const warrantyBondEnabled = Form.useWatch("warrantyBondEnabled", form);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!editing) {
      const id = crypto.randomUUID();
      setDraftId(id);
      setContacts([]);
      setPayments([]);
      setCommissions([]);
      setEditingContactKeys(new Set());
      setEditingPaymentKeys(new Set());
      setEditingCommissionKeys(new Set());
      setContactDrafts({});
      setPaymentDrafts({});
      setCommissionDrafts({});
      form.setFieldsValue({
        contractDate: dayjs(),
        projectName: "",
        ownerUnit: "",
        contractAmount: undefined,
        performanceBondEnabled: false,
        performanceBondReturned: false,
        warrantyBondEnabled: false,
        warrantyBondReturned: false,
      });
      return;
    }
    setLoading(true);
    getContractDetail(contractId!)
      .then((detail) => {
        form.setFieldsValue({
          contractDate: toDayjs(detail.contractDate) || dayjs(),
          projectName: detail.projectName,
          ownerUnit: detail.ownerUnit,
          contractAmount: detail.contractAmount,
          performanceBondEnabled: detail.performanceBondEnabled,
          performanceBondAmount: detail.performanceBondAmount,
          performanceBondType: detail.performanceBondType,
          performanceBondReturnDueAt: toDayjs(detail.performanceBondReturnDueAt),
          performanceBondReturned: detail.performanceBondReturned,
          warrantyBondEnabled: detail.warrantyBondEnabled,
          warrantyBondAmount: detail.warrantyBondAmount,
          warrantyBondType: detail.warrantyBondType,
          warrantyBondReturnDueAt: toDayjs(detail.warrantyBondReturnDueAt),
          warrantyBondReturned: detail.warrantyBondReturned,
        });
        setContacts(
          detail.contacts.map((item) => ({ ...item, key: item.id || crypto.randomUUID() })),
        );
        setPayments(
          detail.payments.map((item) => ({
            ...item,
            key: item.id || crypto.randomUUID(),
          })),
        );
        setCommissions(
          detail.commissions.map((item) => ({
            ...item,
            key: item.id || crypto.randomUUID(),
          })),
        );
        setEditingContactKeys(new Set());
        setEditingPaymentKeys(new Set());
        setEditingCommissionKeys(new Set());
        setContactDrafts({});
        setPaymentDrafts({});
        setCommissionDrafts({});
      })
      .catch((error) => {
        message.error(getErrorMessage(error, "合同详情加载失败"));
      })
      .finally(() => setLoading(false));
  }, [open, editing, contractId, form, message]);

  function beginContactEdit(row: ContactRow) {
    setEditingContactKeys((keys) => new Set(keys).add(row.key));
    setContactDrafts((drafts) => ({ ...drafts, [row.key]: { ...row } }));
  }

  function beginPaymentEdit(row: PaymentRow) {
    setEditingPaymentKeys((keys) => new Set(keys).add(row.key));
    setPaymentDrafts((drafts) => ({ ...drafts, [row.key]: { ...row } }));
  }

  function beginCommissionEdit(row: CommissionRow) {
    setEditingCommissionKeys((keys) => new Set(keys).add(row.key));
    setCommissionDrafts((drafts) => ({ ...drafts, [row.key]: { ...row } }));
  }

  function updateContactDraft(key: string, patch: Partial<ContactRow>) {
    setContactDrafts((drafts) => ({
      ...drafts,
      [key]: { ...(drafts[key] || contacts.find((row) => row.key === key) || { key }), ...patch },
    }));
  }

  function updatePaymentDraft(key: string, patch: Partial<PaymentRow>) {
    setPaymentDrafts((drafts) => ({
      ...drafts,
      [key]: { ...(drafts[key] || payments.find((row) => row.key === key) || { key }), ...patch },
    }));
  }

  function updateCommissionDraft(key: string, patch: Partial<CommissionRow>) {
    setCommissionDrafts((drafts) => ({
      ...drafts,
      [key]: {
        ...(drafts[key] || commissions.find((row) => row.key === key) || { key }),
        ...patch,
      },
    }));
  }

  function clearContactEdit(key: string) {
    setEditingContactKeys((keys) => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
    setContactDrafts((drafts) => {
      const next = { ...drafts };
      delete next[key];
      return next;
    });
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

  function clearCommissionEdit(key: string) {
    setEditingCommissionKeys((keys) => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
    setCommissionDrafts((drafts) => {
      const next = { ...drafts };
      delete next[key];
      return next;
    });
  }

  function removeContact(key: string) {
    setContacts((rows) => rows.filter((item) => item.key !== key));
    clearContactEdit(key);
  }

  function removePayment(key: string) {
    setPayments((rows) => rows.filter((item) => item.key !== key));
    clearPaymentEdit(key);
  }

  function removeCommission(key: string) {
    setCommissions((rows) => rows.filter((item) => item.key !== key));
    clearCommissionEdit(key);
  }

  function saveContactRow(key: string) {
    const draft = contactDrafts[key] || contacts.find((row) => row.key === key);
    if (!draft) {
      return;
    }
    const hasValue = Boolean(draft.name || draft.phone || draft.position);
    if (hasValue && (!draft.name || !draft.phone || !draft.position)) {
      message.error("经办人记录需要同时填写姓名、电话和职位");
      return;
    }
    setContacts((rows) => rows.map((row) => (row.key === key ? { ...row, ...draft } : row)));
    clearContactEdit(key);
  }

  function savePaymentRow(key: string) {
    const draft = paymentDrafts[key] || payments.find((row) => row.key === key);
    if (!draft) {
      return;
    }
    const hasValue = Number(draft.amount || 0) > 0 || Boolean(draft.paidAt);
    if (hasValue && !draft.paidAt) {
      message.error("合同收款记录需要同时填写金额和收款日期");
      return;
    }
    setPayments((rows) => rows.map((row) => (row.key === key ? { ...row, ...draft } : row)));
    clearPaymentEdit(key);
  }

  function saveCommissionRow(key: string) {
    const draft = commissionDrafts[key] || commissions.find((row) => row.key === key);
    if (!draft) {
      return;
    }
    const hasValue = Boolean(draft.salesperson) || Number(draft.commissionAmount || 0) > 0;
    if (hasValue && (!draft.salesperson || Number(draft.commissionAmount || 0) < 0)) {
      message.error("业务员提成记录需要同时填写业务员和提成");
      return;
    }
    setCommissions((rows) => rows.map((row) => (row.key === key ? { ...row, ...draft } : row)));
    clearCommissionEdit(key);
  }

  function addContactRow() {
    const key = crypto.randomUUID();
    const row = { key };
    setContacts((rows) => [...rows, row]);
    setEditingContactKeys((keys) => new Set(keys).add(key));
    setContactDrafts((drafts) => ({ ...drafts, [key]: row }));
  }

  function addPaymentRow() {
    const key = crypto.randomUUID();
    const row = { key, amount: 0, paidAt: dayjs().format("YYYY-MM-DD") };
    setPayments((rows) => [...rows, row]);
    setEditingPaymentKeys((keys) => new Set(keys).add(key));
    setPaymentDrafts((drafts) => ({ ...drafts, [key]: row }));
  }

  function addCommissionRow() {
    const key = crypto.randomUUID();
    const row = { key, commissionAmount: 0 };
    setCommissions((rows) => [...rows, row]);
    setEditingCommissionKeys((keys) => new Set(keys).add(key));
    setCommissionDrafts((drafts) => ({ ...drafts, [key]: row }));
  }

  function hasUnsavedTableDrafts() {
    return (
      Object.values(contactDrafts).some((row) => row.name || row.phone || row.position) ||
      Object.values(paymentDrafts).some((row) => Number(row.amount || 0) > 0 || row.paidAt) ||
      Object.values(commissionDrafts).some(
        (row) => row.salesperson || Number(row.commissionAmount || 0) > 0,
      )
    );
  }

  const contactColumns = useMemo<ColumnsType<ContactRow>>(
    () => [
      {
        title: "经办人姓名",
        dataIndex: "name",
        render: (_, row) => {
          const editingRow = editingContactKeys.has(row.key);
          const value = editingRow ? contactDrafts[row.key] || row : row;
          if (!editingRow) {
            return <ReadonlyText value={value.name} />;
          }
          return (
            <Input
              value={value.name || ""}
              onChange={(event) => updateContactDraft(row.key, { name: event.target.value })}
            />
          );
        },
      },
      {
        title: "经办人电话",
        dataIndex: "phone",
        render: (_, row) => {
          const editingRow = editingContactKeys.has(row.key);
          const value = editingRow ? contactDrafts[row.key] || row : row;
          if (!editingRow) {
            return <ReadonlyText value={value.phone} />;
          }
          return (
            <Input
              value={value.phone || ""}
              onChange={(event) => updateContactDraft(row.key, { phone: event.target.value })}
            />
          );
        },
      },
      {
        title: "经办人职位",
        dataIndex: "position",
        render: (_, row) => {
          const editingRow = editingContactKeys.has(row.key);
          const value = editingRow ? contactDrafts[row.key] || row : row;
          if (!editingRow) {
            return <ReadonlyText value={value.position} />;
          }
          return (
            <Input
              value={value.position || ""}
              onChange={(event) => updateContactDraft(row.key, { position: event.target.value })}
            />
          );
        },
      },
      {
        title: "操作",
        width: 210,
        render: (_, row) => {
          const editingRow = editingContactKeys.has(row.key);
          return (
            <Space size={4}>
              <Button danger type="link" icon={<Trash2 size={15} />} onClick={() => removeContact(row.key)}>
                删除
              </Button>
              <Button
                type="link"
                icon={<Pencil size={15} />}
                disabled={editingRow}
                onClick={() => beginContactEdit(row)}
              >
                编辑
              </Button>
              <Button
                type="link"
                icon={<Save size={15} />}
                disabled={!editingRow}
                onClick={() => saveContactRow(row.key)}
              >
                保存
              </Button>
            </Space>
          );
        },
      },
    ],
    [contactDrafts, contacts, editingContactKeys],
  );

  const paymentColumns = useMemo<ColumnsType<PaymentRow>>(
    () => [
      {
        title: "收款金额（万元）",
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
              addonAfter="万元"
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

  const commissionColumns = useMemo<ColumnsType<CommissionRow>>(
    () => [
      {
        title: "业务员",
        dataIndex: "salesperson",
        render: (_, row) => {
          const editingRow = editingCommissionKeys.has(row.key);
          const value = editingRow ? commissionDrafts[row.key] || row : row;
          if (!editingRow) {
            return <ReadonlyText value={value.salesperson} />;
          }
          return (
            <Input
              value={value.salesperson || ""}
              onChange={(event) =>
                updateCommissionDraft(row.key, { salesperson: event.target.value })
              }
            />
          );
        },
      },
      {
        title: "提成（万元）",
        dataIndex: "commissionAmount",
        width: 180,
        render: (_, row) => {
          const editingRow = editingCommissionKeys.has(row.key);
          const value = editingRow ? commissionDrafts[row.key] || row : row;
          if (!editingRow) {
            return <ReadonlyMoney value={value.commissionAmount} />;
          }
          return (
            <InputNumber
              min={0}
              precision={2}
              value={value.commissionAmount}
              addonAfter="万元"
              style={{ width: "100%" }}
              onChange={(commissionAmount) =>
                updateCommissionDraft(row.key, { commissionAmount })
              }
            />
          );
        },
      },
      {
        title: "提成付款时间",
        dataIndex: "commissionPaidAt",
        width: 180,
        render: (_, row) => {
          const editingRow = editingCommissionKeys.has(row.key);
          const value = editingRow ? commissionDrafts[row.key] || row : row;
          if (!editingRow) {
            return <ReadonlyText value={value.commissionPaidAt} />;
          }
          return (
            <DatePicker
              value={toDayjs(value.commissionPaidAt)}
              style={{ width: "100%" }}
              onChange={(commissionPaidAt) =>
                updateCommissionDraft(row.key, {
                  commissionPaidAt: toDateString(commissionPaidAt),
                })
              }
            />
          );
        },
      },
      {
        title: "操作",
        width: 210,
        render: (_, row) => {
          const editingRow = editingCommissionKeys.has(row.key);
          return (
            <Space size={4}>
              <Button danger type="link" icon={<Trash2 size={15} />} onClick={() => removeCommission(row.key)}>
                删除
              </Button>
              <Button
                type="link"
                icon={<Pencil size={15} />}
                disabled={editingRow}
                onClick={() => beginCommissionEdit(row)}
              >
                编辑
              </Button>
              <Button
                type="link"
                icon={<Save size={15} />}
                disabled={!editingRow}
                onClick={() => saveCommissionRow(row.key)}
              >
                保存
              </Button>
            </Space>
          );
        },
      },
    ],
    [commissionDrafts, commissions, editingCommissionKeys],
  );

  async function handleFinish(values: ContractFormValues) {
    if (hasUnsavedTableDrafts()) {
      message.error("请先保存正在编辑的表格行");
      return;
    }

    const normalizedContacts: ContactRecord[] = contacts
      .filter((row) => row.name || row.phone || row.position)
      .map(({ id, name, phone, position }) => ({ id, name, phone, position }));
    const normalizedPayments: PaymentRecord[] = payments
      .filter((row) => Number(row.amount || 0) > 0 || row.paidAt)
      .map(({ id, amount, paidAt }) => ({
        id,
        amount: Number(amount || 0),
        paidAt: paidAt || "",
      }));
    const normalizedCommissions: CommissionRecord[] = commissions
      .filter((row) => row.salesperson || Number(row.commissionAmount || 0) > 0)
      .map(({ id, salesperson, commissionAmount, commissionPaidAt }) => ({
        id,
        salesperson: salesperson || "",
        commissionAmount: Number(commissionAmount || 0),
        commissionPaidAt: commissionPaidAt || null,
      }));

    if (normalizedPayments.some((row) => row.amount < 0 || !row.paidAt)) {
      message.error("合同收款记录需要同时填写金额和收款日期");
      return;
    }
    if (normalizedContacts.some((row) => !row.name || !row.phone || !row.position)) {
      message.error("经办人记录需要同时填写姓名、电话和职位");
      return;
    }
    if (normalizedCommissions.some((row) => !row.salesperson || row.commissionAmount < 0)) {
      message.error("业务员提成记录需要同时填写业务员和提成");
      return;
    }

    const payload: ContractPayload = {
      contract: {
        id: editing ? contractId : draftId,
        contractDate: toDateString(values.contractDate),
        projectName: values.projectName,
        ownerUnit: values.ownerUnit,
        contractAmount: Number(values.contractAmount || 0),
        performanceBondEnabled: Boolean(values.performanceBondEnabled),
        performanceBondAmount: values.performanceBondEnabled
          ? Number(values.performanceBondAmount || 0)
          : null,
        performanceBondType: values.performanceBondEnabled
          ? values.performanceBondType || null
          : null,
        performanceBondReturnDueAt: values.performanceBondEnabled
          ? toDateString(values.performanceBondReturnDueAt)
          : null,
        performanceBondReturned: Boolean(values.performanceBondReturned),
        warrantyBondEnabled: Boolean(values.warrantyBondEnabled),
        warrantyBondAmount: values.warrantyBondEnabled
          ? Number(values.warrantyBondAmount || 0)
          : null,
        warrantyBondType: values.warrantyBondEnabled ? values.warrantyBondType || null : null,
        warrantyBondReturnDueAt: values.warrantyBondEnabled
          ? toDateString(values.warrantyBondReturnDueAt)
          : null,
        warrantyBondReturned: Boolean(values.warrantyBondReturned),
      },
      contacts: normalizedContacts,
      payments: normalizedPayments,
      commissions: normalizedCommissions,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateContract(contractId!, payload);
      } else {
        await createContract(payload);
      }
      message.success(editing ? "合同已更新" : "合同已添加");
      onSaved();
      onClose();
    } catch (error) {
      message.error(getErrorMessage(error, editing ? "合同更新失败" : "合同添加失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title={editing ? "编辑合同" : "添加合同"}
      open={open}
      onClose={onClose}
      width={920}
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
          <div className="form-grid">
            <Form.Item
              label="时间"
              name="contractDate"
              rules={[{ required: true, message: "请选择时间" }]}
            >
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="合同金额（万元）"
              name="contractAmount"
              rules={[{ required: true, message: "请输入合同金额" }]}
            >
              <InputNumber min={0} precision={2} addonAfter="万元" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="项目名称"
              name="projectName"
              rules={[{ required: true, message: "请输入项目名称" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="业主单位"
              name="ownerUnit"
              rules={[{ required: true, message: "请输入业主单位" }]}
            >
              <Input />
            </Form.Item>
          </div>
          <div className="attachment-field">
            <div className="attachment-grid">
              {CONTRACT_ATTACHMENT_GROUPS.map((group) => (
                <div className="attachment-group" key={group.category}>
                  <Typography.Text className="attachment-group-title" type="secondary">
                    {group.label}
                  </Typography.Text>
                  <AttachmentList
                    bizType="contract"
                    bizId={attachmentBizId}
                    category={group.category}
                    compact
                    maxCount={group.maxCount}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <Space className="section-toolbar">
            <div className="form-section-title">经办人</div>
            <Button
              icon={<Plus size={15} />}
              onClick={addContactRow}
            >
              添加经办人
            </Button>
          </Space>
          <Table
            className="inline-edit-table"
            rowKey="key"
            columns={contactColumns}
            dataSource={contacts}
            pagination={false}
            size="small"
          />
        </div>

        <div className="form-section">
          <div className="form-section-title">履约保证金</div>
          <Form.Item label="是否有履约保证金" name="performanceBondEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="form-grid">
            <Form.Item
              label="履约保证金（万元）"
              name="performanceBondAmount"
              rules={[
                {
                  required: performanceBondEnabled,
                  message: "请输入履约保证金",
                },
              ]}
            >
              <InputNumber
                min={0}
                precision={2}
                addonAfter="万元"
                style={{ width: "100%" }}
                disabled={!performanceBondEnabled}
              />
            </Form.Item>
            <Form.Item label="履约保证金形式" name="performanceBondType">
              <Input disabled={!performanceBondEnabled} placeholder="现金、保函等" />
            </Form.Item>
            <Form.Item
              label="履约保证金约定退还时间"
              name="performanceBondReturnDueAt"
              rules={[
                {
                  required: performanceBondEnabled,
                  message: "请选择履约保证金约定退还时间",
                },
              ]}
            >
              <DatePicker style={{ width: "100%" }} disabled={!performanceBondEnabled} />
            </Form.Item>
            <Form.Item label="是否已经退还" name="performanceBondReturned" valuePropName="checked">
              <Switch disabled={!performanceBondEnabled} />
            </Form.Item>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">质保金</div>
          <Form.Item label="是否有质保金" name="warrantyBondEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="form-grid">
            <Form.Item
              label="质保金（万元）"
              name="warrantyBondAmount"
              rules={[
                {
                  required: warrantyBondEnabled,
                  message: "请输入质保金",
                },
              ]}
            >
              <InputNumber
                min={0}
                precision={2}
                addonAfter="万元"
                style={{ width: "100%" }}
                disabled={!warrantyBondEnabled}
              />
            </Form.Item>
            <Form.Item label="质保金形式" name="warrantyBondType">
              <Input disabled={!warrantyBondEnabled} placeholder="现金、扣款等" />
            </Form.Item>
            <Form.Item
              label="质保金约定退还时间"
              name="warrantyBondReturnDueAt"
              rules={[
                {
                  required: warrantyBondEnabled,
                  message: "请选择质保金约定退还时间",
                },
              ]}
            >
              <DatePicker style={{ width: "100%" }} disabled={!warrantyBondEnabled} />
            </Form.Item>
            <Form.Item label="是否已经退还" name="warrantyBondReturned" valuePropName="checked">
              <Switch disabled={!warrantyBondEnabled} />
            </Form.Item>
          </div>
        </div>

        <div className="form-section">
          <Space className="section-toolbar">
            <div className="form-section-title">收款记录</div>
            <Button
              icon={<Plus size={15} />}
              onClick={addPaymentRow}
            >
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

        <div className="form-section">
          <Space className="section-toolbar">
            <div className="form-section-title">业务员提成</div>
            <Button
              icon={<Plus size={15} />}
              onClick={addCommissionRow}
            >
              添加业务员
            </Button>
          </Space>
          <Table
            className="inline-edit-table"
            rowKey="key"
            columns={commissionColumns}
            dataSource={commissions}
            pagination={false}
            size="small"
          />
        </div>
      </Form>
    </Drawer>
  );
}
