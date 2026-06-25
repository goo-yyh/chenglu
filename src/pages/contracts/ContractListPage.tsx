import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import MoneyText from "../../components/MoneyText";
import { deleteContract, listContracts } from "../../services/contractApi";
import { BOND_TYPE_GUARANTEE } from "../../types/contract";
import type {
  ContractListItem,
  ContractListQuery,
  ContractListSummary,
} from "../../types/contract";
import { getErrorMessage } from "../../utils/errors";
import ContractDetailDrawer from "./ContractDetailDrawer";
import ContractFormDrawer from "./ContractFormDrawer";
import SupplementDetailDrawer from "./SupplementDetailDrawer";
import SupplementFormDrawer from "./SupplementFormDrawer";
import SupplementTable from "./SupplementTable";

const { RangePicker } = DatePicker;
const DEFAULT_PAGE_SIZE = 12;
const EMPTY_SUMMARY: ContractListSummary = {
  contractAmount: 0,
  paidAmount: 0,
  unpaidAmount: 0,
  performanceBondUnreturnedAmount: 0,
  warrantyBondUnreturnedAmount: 0,
};

interface ContractFilterValues {
  contractDateRange?: [Dayjs, Dayjs];
  projectName?: string;
  ownerUnit?: string;
  salesperson?: string;
  performanceBondReturned?: boolean;
  warrantyBondReturned?: boolean;
  paymentSettled?: boolean;
}

function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function bondNeedsReturn(enabled: boolean, type?: string | null) {
  return enabled && type !== BOND_TYPE_GUARANTEE;
}

function buildContractListQuery(
  values: ContractFilterValues,
  page: number,
  pageSize: number,
): ContractListQuery {
  return {
    page,
    pageSize,
    contractDateStart: values.contractDateRange?.[0]?.format("YYYY-MM-DD"),
    contractDateEnd: values.contractDateRange?.[1]?.format("YYYY-MM-DD"),
    projectName: optionalText(values.projectName),
    ownerUnit: optionalText(values.ownerUnit),
    salesperson: optionalText(values.salesperson),
    performanceBondReturned: values.performanceBondReturned,
    warrantyBondReturned: values.warrantyBondReturned,
    paymentSettled: values.paymentSettled,
  };
}

export default function ContractListPage() {
  const { message } = App.useApp();
  const [filterForm] = Form.useForm<ContractFilterValues>();
  const [rows, setRows] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ContractListSummary>(EMPTY_SUMMARY);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [query, setQuery] = useState<ContractListQuery>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [supplementRefreshKey, setSupplementRefreshKey] = useState(0);
  const [contractForm, setContractForm] = useState<{
    open: boolean;
    contractId?: string;
  }>({ open: false });
  const [contractDetailId, setContractDetailId] = useState<string>();
  const [supplementForm, setSupplementForm] = useState<{
    open: boolean;
    contractId?: string;
    supplementId?: string;
  }>({ open: false });
  const [supplementDetailId, setSupplementDetailId] = useState<string>();
  const [expandedContractId, setExpandedContractId] = useState<string>();

  async function load(nextQuery: ContractListQuery = query) {
    setLoading(true);
    try {
      const result = await listContracts(nextQuery);
      setRows(result.items);
      setTotal(result.total);
      setSummary(result.summary || EMPTY_SUMMARY);
      setQuery({
        ...nextQuery,
        page: result.page,
        pageSize: result.pageSize,
      });
    } catch (error) {
      message.error(getErrorMessage(error, "合同列表查询失败"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, []);

  useEffect(() => {
    if (
      expandedContractId &&
      !rows.some((row) => row.id === expandedContractId && row.supplementCount > 0)
    ) {
      setExpandedContractId(undefined);
    }
  }, [expandedContractId, rows]);

  async function handleSearch(values: ContractFilterValues) {
    await load(buildContractListQuery(values, 1, query.pageSize));
  }

  async function handleReset() {
    filterForm.resetFields();
    await load({ page: 1, pageSize: query.pageSize });
  }

  function handleTableChange(pagination: TablePaginationConfig) {
    void load({
      ...query,
      page: pagination.current || 1,
      pageSize: pagination.pageSize || query.pageSize,
    });
  }

  async function handleDelete(id: string) {
    try {
      await deleteContract(id);
      message.success("合同已删除");
      await load({
        ...query,
        page: rows.length === 1 && query.page > 1 ? query.page - 1 : query.page,
      });
      setSupplementRefreshKey((value) => value + 1);
    } catch (error) {
      message.error(getErrorMessage(error, "合同删除失败"));
    }
  }

  function bondReturnTag(enabled: boolean, type: string | null | undefined, returned: boolean) {
    if (!bondNeedsReturn(enabled, type)) {
      return "-";
    }
    return returned ? <Tag color="green">已退还</Tag> : <Tag color="orange">未退还</Tag>;
  }

  const columns = useMemo<ColumnsType<ContractListItem>>(
    () => [
      {
        title: "时间",
        dataIndex: "contractDate",
        width: 120,
        fixed: "left",
      },
      {
        title: "项目名称",
        dataIndex: "projectName",
        width: 180,
        fixed: "left",
        ellipsis: true,
      },
      {
        title: "业主单位",
        dataIndex: "ownerUnit",
        width: 180,
        ellipsis: true,
      },
      {
        title: "合同金额（元）",
        dataIndex: "contractAmount",
        width: 170,
        render: (value) => <MoneyText value={value} />,
      },
      {
        title: "履约保证金（元）",
        dataIndex: "performanceBondAmount",
        width: 180,
        render: (_, row) =>
          row.performanceBondEnabled ? (
            <MoneyText value={row.performanceBondAmount} />
          ) : (
            <Tag>无</Tag>
          ),
      },
      {
        title: "履约保证金是否退还",
        dataIndex: "performanceBondReturned",
        width: 180,
        render: (_, row) =>
          bondReturnTag(
            row.performanceBondEnabled,
            row.performanceBondType,
            row.performanceBondReturned,
          ),
      },
      {
        title: "履约保证金约定退还时间",
        dataIndex: "performanceBondReturnDueAt",
        width: 230,
        render: (value, row) =>
          bondNeedsReturn(row.performanceBondEnabled, row.performanceBondType)
            ? value || "-"
            : "-",
      },
      {
        title: "质保金（元）",
        dataIndex: "warrantyBondAmount",
        width: 180,
        render: (_, row) =>
          row.warrantyBondEnabled ? (
            <MoneyText value={row.warrantyBondAmount} />
          ) : (
            <Tag>无</Tag>
          ),
      },
      {
        title: "质保金是否退还",
        dataIndex: "warrantyBondReturned",
        width: 160,
        render: (_, row) =>
          bondReturnTag(
            row.warrantyBondEnabled,
            row.warrantyBondType,
            row.warrantyBondReturned,
          ),
      },
      {
        title: "质保金约定退还时间",
        dataIndex: "warrantyBondReturnDueAt",
        width: 210,
        render: (value, row) =>
          bondNeedsReturn(row.warrantyBondEnabled, row.warrantyBondType) ? value || "-" : "-",
      },
      {
        title: "合同附件",
        dataIndex: "attachmentSummary",
        width: 120,
        render: (_, row) =>
          row.attachmentSummary.count > 0 ? (
            <Tooltip title={row.attachmentSummary.names.join("、")}>
              <Tag color="blue">{row.attachmentSummary.count} 个附件</Tag>
            </Tooltip>
          ) : (
            <Tag>无附件</Tag>
          ),
      },
      {
        title: "已收款金额（元）",
        dataIndex: "paidAmount",
        width: 170,
        render: (value) => <MoneyText value={value} />,
      },
      {
        title: "未收款金额（元）",
        dataIndex: "unpaidAmount",
        width: 170,
        render: (value) => <MoneyText value={value} />,
      },
      {
        title: "操作",
        fixed: "right",
        width: 380,
        render: (_, row) => (
          <Space className="table-action-cell" size={4}>
            <Button
              type="link"
              size="small"
              icon={<Pencil size={15} />}
              onClick={() => setContractForm({ open: true, contractId: row.id })}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              icon={<Eye size={15} />}
              onClick={() => setContractDetailId(row.id)}
            >
              查看详情
            </Button>
            <Popconfirm
              title="删除合同"
              description="确定删除这个合同吗？"
              onConfirm={() => handleDelete(row.id)}
            >
              <Button danger type="link" size="small" icon={<Trash2 size={15} />}>
                删除
              </Button>
            </Popconfirm>
            <Button
              type="link"
              size="small"
              icon={<Plus size={15} />}
              onClick={() =>
                setSupplementForm({ open: true, contractId: row.id })
              }
            >
              添加增补合同
            </Button>
          </Space>
        ),
      },
    ],
    [query, rows.length],
  );

  return (
    <div className="page-surface">
      <div className="page-action-toolbar">
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setContractForm({ open: true })}
        >
          添加合同
        </Button>
      </div>

      <div className="filter-panel">
        <Form
          form={filterForm}
          className="filter-grid-form"
          layout="horizontal"
          colon={false}
          requiredMark={false}
          onFinish={handleSearch}
        >
          <div className="filter-grid">
            <Form.Item label="合同时间" name="contractDateRange" className="filter-field">
              <RangePicker />
            </Form.Item>
            <Form.Item label="项目名称" name="projectName" className="filter-field">
              <Input allowClear placeholder="输入项目名称" />
            </Form.Item>
            <Form.Item label="业主单位" name="ownerUnit" className="filter-field">
              <Input allowClear placeholder="输入业主单位" />
            </Form.Item>
            <Form.Item label="业务员名称" name="salesperson" className="filter-field">
              <Input allowClear placeholder="输入业务员名称" />
            </Form.Item>
            {advancedFiltersOpen && (
              <>
                <Form.Item
                  label="履约保证金是否退还"
                  name="performanceBondReturned"
                  className="filter-field"
                >
                  <Select
                    allowClear
                    placeholder="全部"
                    options={[
                      { label: "已退还", value: true },
                      { label: "未退还", value: false },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="质保金是否退还"
                  name="warrantyBondReturned"
                  className="filter-field"
                >
                  <Select
                    allowClear
                    placeholder="全部"
                    options={[
                      { label: "已退还", value: true },
                      { label: "未退还", value: false },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="款项是否结清" name="paymentSettled" className="filter-field">
                  <Select
                    allowClear
                    placeholder="全部"
                    options={[
                      { label: "已结清", value: true },
                      { label: "未结清", value: false },
                    ]}
                  />
                </Form.Item>
              </>
            )}
            <div className="filter-actions">
              <Space>
                <Button type="primary" htmlType="submit">
                  查询
                </Button>
                <Button onClick={handleReset}>重置</Button>
                <Button
                  type="link"
                  icon={
                    advancedFiltersOpen ? (
                      <ChevronUp size={15} />
                    ) : (
                      <ChevronDown size={15} />
                    )
                  }
                  onClick={() => setAdvancedFiltersOpen((open) => !open)}
                >
                  {advancedFiltersOpen ? "收起" : "展开"}
                </Button>
              </Space>
            </div>
          </div>
        </Form>
      </div>

      <div className="summary-grid">
        <Statistic title="合同金额" value={summary.contractAmount} precision={2} suffix="元" />
        <Statistic title="已收款金额" value={summary.paidAmount} precision={2} suffix="元" />
        <Statistic title="未收款金额" value={summary.unpaidAmount} precision={2} suffix="元" />
        <Statistic
          title="履约保证金未退金额"
          value={summary.performanceBondUnreturnedAmount}
          precision={2}
          suffix="元"
        />
        <Statistic
          title="质保金未退金额"
          value={summary.warrantyBondUnreturnedAmount}
          precision={2}
          suffix="元"
        />
      </div>

      <div className="table-wrap">
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowClassName={(row) =>
            row.id === expandedContractId ? "contract-row-expanded" : ""
          }
          scroll={{ x: 2360 }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
          }}
          onChange={handleTableChange}
          expandable={{
            columnWidth: 56,
            expandedRowKeys: expandedContractId ? [expandedContractId] : [],
            expandedRowClassName: () => "supplement-inline-row",
            rowExpandable: (row) => row.supplementCount > 0,
            onExpand: (expanded, row) =>
              setExpandedContractId(expanded ? row.id : undefined),
            expandIcon: ({ expanded, onExpand, record }) =>
              record.supplementCount > 0 ? (
                <Button
                  aria-label={expanded ? "收起增补合同" : "展开增补合同"}
                  className="row-expand-button"
                  type="text"
                  size="small"
                  icon={expanded ? <ChevronUp size={15} /> : <Plus size={15} />}
                  onClick={(event) => onExpand(record, event)}
                />
              ) : (
                <span className="row-expand-placeholder" />
              ),
            expandedRowRender: (row) => (
              <div className="supplement-panel">
                <div className="supplement-panel-body">
                  <SupplementTable
                    contractId={row.id}
                    refreshKey={supplementRefreshKey}
                    onEdit={(id) =>
                      setSupplementForm({
                        open: true,
                        contractId: row.id,
                        supplementId: id,
                      })
                    }
                    onView={setSupplementDetailId}
                    onChanged={() => {
                      void load(query);
                      setSupplementRefreshKey((value) => value + 1);
                    }}
                  />
                </div>
              </div>
            ),
          }}
        />
      </div>

      <ContractFormDrawer
        open={contractForm.open}
        contractId={contractForm.contractId}
        onClose={() => setContractForm({ open: false })}
        onSaved={() => void load(query)}
      />
      <ContractDetailDrawer
        open={Boolean(contractDetailId)}
        contractId={contractDetailId}
        onClose={() => setContractDetailId(undefined)}
      />
      <SupplementFormDrawer
        open={supplementForm.open}
        contractId={supplementForm.contractId}
        supplementId={supplementForm.supplementId}
        onClose={() => setSupplementForm({ open: false })}
        onSaved={() => {
          void load(query);
          setSupplementRefreshKey((value) => value + 1);
        }}
      />
      <SupplementDetailDrawer
        open={Boolean(supplementDetailId)}
        supplementId={supplementDetailId}
        onClose={() => setSupplementDetailId(undefined)}
      />
    </div>
  );
}
