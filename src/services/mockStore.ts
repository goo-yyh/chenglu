import type {
  AttachmentBizType,
  AttachmentCategory,
  AttachmentRecord,
} from "../types/attachment";
import { BOND_TYPE_GUARANTEE } from "../types/contract";
import type {
  CommissionRecord,
  ContactRecord,
  ContractDetail,
  ContractInput,
  ContractListItem,
  ContractListQuery,
  ContractListResult,
  ContractListSummary,
  ContractPayload,
  PaymentRecord,
} from "../types/contract";
import type {
  SupplementDetail,
  SupplementInput,
  SupplementListItem,
  SupplementPayload,
} from "../types/supplement";
import type { BackupInfo, SystemInfo } from "../types/system";

interface StoredContract extends ContractInput {
  id: string;
  contacts: ContactRecord[];
  payments: PaymentRecord[];
  commissions: CommissionRecord[];
  createdAt: string;
  updatedAt: string;
}

interface StoredSupplement extends SupplementInput {
  id: string;
  contractId: string;
  payments: PaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

interface StoreShape {
  contracts: StoredContract[];
  supplements: StoredSupplement[];
  attachments: AttachmentRecord[];
  backups: BackupInfo[];
}

const STORAGE_KEY = "chenglu_admin_mock_store";

function blankStore(): StoreShape {
  return {
    contracts: [],
    supplements: [],
    attachments: [],
    backups: [],
  };
}

function readStore(): StoreShape {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return blankStore();
  }
  try {
    return { ...blankStore(), ...JSON.parse(raw) };
  } catch {
    return blankStore();
  }
}

function writeStore(store: StoreShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function sum(payments: PaymentRecord[]) {
  return payments.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function bondRequiresReturn(enabled: boolean, type?: string | null) {
  return enabled && type !== BOND_TYPE_GUARANTEE;
}

function attachmentSummary(attachments: AttachmentRecord[]) {
  return {
    count: attachments.length,
    names: attachments.map((item) => item.originalFileName),
  };
}

function normalizeStoredContract(contract: StoredContract): StoredContract {
  return {
    ...contract,
    performanceBondEnabled: Boolean(contract.performanceBondEnabled),
    performanceBondReturned: Boolean(contract.performanceBondReturned),
    prepaymentEnabled: Boolean(contract.prepaymentEnabled),
    prepaymentType: contract.prepaymentType || BOND_TYPE_GUARANTEE,
    warrantyBondEnabled: Boolean(contract.warrantyBondEnabled),
    warrantyBondReturned: Boolean(contract.warrantyBondReturned),
  };
}

function normalizeAttachmentCategory(item: AttachmentRecord): AttachmentCategory {
  if (item.category) {
    return item.category;
  }
  return item.bizType === "contract_supplement" ? "supplement_file" : "contract_file";
}

function isValidAttachmentCategory(
  bizType: AttachmentBizType,
  category: AttachmentCategory,
) {
  if (bizType === "contract") {
    return [
      "contract_file",
      "award_notice",
      "tender_file",
      "bid_file",
      "acceptance_report",
      "invoice",
      "performance_remittance_voucher",
      "performance_guarantee_voucher",
      "prepayment_remittance_voucher",
      "prepayment_guarantee_voucher",
      "warranty_remittance_voucher",
      "warranty_guarantee_voucher",
    ].includes(category);
  }
  return category === "supplement_file";
}

function allowedAttachmentExtensions(category: AttachmentCategory) {
  if (
    category === "performance_remittance_voucher" ||
    category === "prepayment_remittance_voucher" ||
    category === "warranty_remittance_voucher"
  ) {
    return ["jpg", "jpeg", "png", "pdf"];
  }
  if (
    category === "performance_guarantee_voucher" ||
    category === "prepayment_guarantee_voucher" ||
    category === "warranty_guarantee_voucher"
  ) {
    return ["pdf"];
  }
  return ["doc", "docx", "xls", "xlsx", "pdf"];
}

function contractListItem(contract: StoredContract, store: StoreShape): ContractListItem {
  const normalized = normalizeStoredContract(contract);
  const paidAmount = sum(contract.payments);
  return {
    ...normalized,
    paidAmount,
    unpaidAmount: normalized.contractAmount - paidAmount,
    supplementCount: store.supplements.filter((item) => item.contractId === contract.id).length,
    attachmentSummary: attachmentSummary(
      store.attachments.filter(
        (item) => item.bizType === "contract" && item.bizId === contract.id,
      ),
    ),
  };
}

function supplementAmountTotal(store: StoreShape, contractId: string) {
  return store.supplements
    .filter((item) => item.contractId === contractId)
    .reduce((total, item) => total + Number(item.supplementAmount || 0), 0);
}

function supplementPaidTotal(store: StoreShape, contractId: string) {
  return store.supplements
    .filter((item) => item.contractId === contractId)
    .reduce((total, item) => total + sum(item.payments), 0);
}

function buildSummary(
  rows: Array<{ contract: StoredContract; item: ContractListItem }>,
  store: StoreShape,
): ContractListSummary {
  return rows.reduce(
    (summary, { item }) => {
      const contractAmount = item.contractAmount + supplementAmountTotal(store, item.id);
      const paidAmount = item.paidAmount + supplementPaidTotal(store, item.id);
      summary.contractAmount += contractAmount;
      summary.paidAmount += paidAmount;
      summary.unpaidAmount += contractAmount - paidAmount;
      if (
        bondRequiresReturn(item.performanceBondEnabled, item.performanceBondType) &&
        !item.performanceBondReturned
      ) {
        summary.performanceBondUnreturnedAmount += Number(item.performanceBondAmount || 0);
      }
      if (
        bondRequiresReturn(item.warrantyBondEnabled, item.warrantyBondType) &&
        !item.warrantyBondReturned
      ) {
        summary.warrantyBondUnreturnedAmount += Number(item.warrantyBondAmount || 0);
      }
      return summary;
    },
    {
      contractAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      performanceBondUnreturnedAmount: 0,
      warrantyBondUnreturnedAmount: 0,
    },
  );
}

function supplementListItem(
  supplement: StoredSupplement,
  store: StoreShape,
): SupplementListItem {
  const paidAmount = sum(supplement.payments);
  return {
    id: supplement.id,
    contractId: supplement.contractId,
    supplementAmount: supplement.supplementAmount,
    supplementDate: supplement.supplementDate,
    paidAmount,
    unpaidAmount: supplement.supplementAmount - paidAmount,
    attachmentSummary: attachmentSummary(
      store.attachments.filter(
        (item) =>
          item.bizType === "contract_supplement" && item.bizId === supplement.id,
      ),
    ),
    createdAt: supplement.createdAt,
    updatedAt: supplement.updatedAt,
  };
}

export function mockValidateLogin(account: string, password: string) {
  return account === "chenglu" && password === "88888888";
}

function includesKeyword(value: string | null | undefined, keyword: string | null | undefined) {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }
  return (value || "").toLowerCase().includes(normalizedKeyword);
}

function matchesContractQuery(
  contract: StoredContract,
  item: ContractListItem,
  query: ContractListQuery,
) {
  if (query.contractDateStart && item.contractDate < query.contractDateStart) {
    return false;
  }
  if (query.contractDateEnd && item.contractDate > query.contractDateEnd) {
    return false;
  }
  if (!includesKeyword(item.projectName, query.projectName)) {
    return false;
  }
  if (!includesKeyword(item.ownerUnit, query.ownerUnit)) {
    return false;
  }
  if (
    query.salesperson?.trim() &&
    !contract.commissions.some((commission) =>
      includesKeyword(commission.salesperson, query.salesperson),
    )
  ) {
    return false;
  }
  if (
    query.performanceBondReturned !== undefined &&
    (!bondRequiresReturn(item.performanceBondEnabled, item.performanceBondType) ||
      item.performanceBondReturned !== query.performanceBondReturned)
  ) {
    return false;
  }
  if (
    query.warrantyBondReturned !== undefined &&
    (!bondRequiresReturn(item.warrantyBondEnabled, item.warrantyBondType) ||
      item.warrantyBondReturned !== query.warrantyBondReturned)
  ) {
    return false;
  }
  if (query.paymentSettled !== undefined) {
    const settled = item.unpaidAmount <= 0;
    if (settled !== query.paymentSettled) {
      return false;
    }
  }
  return true;
}

export function mockListContracts(query: ContractListQuery): ContractListResult {
  const store = readStore();
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.max(1, Number(query.pageSize || 12));
  const matched = store.contracts
    .map((contract) => ({ contract: normalizeStoredContract(contract), item: contractListItem(contract, store) }))
    .filter(({ contract, item }) => matchesContractQuery(contract, item, query));
  const items = matched.map(({ item }) => item);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
    summary: buildSummary(matched, store),
  };
}

export function mockGetContractDetail(contractId: string): ContractDetail {
  const store = readStore();
  const contract = store.contracts.find((item) => item.id === contractId);
  if (!contract) {
    throw new Error("合同不存在");
  }
  const base = contractListItem(contract, store);
  const supplements = store.supplements
    .filter((item) => item.contractId === contractId)
    .map((item) => supplementListItem(item, store));
  return {
    ...base,
    contacts: contract.contacts,
    payments: contract.payments,
    commissions: contract.commissions,
    attachments: store.attachments.filter(
      (item) => item.bizType === "contract" && item.bizId === contractId,
    ),
    supplements,
    totalAmount:
      contract.contractAmount +
      supplements.reduce((total, item) => total + item.supplementAmount, 0),
  };
}

export function mockCreateContract(payload: ContractPayload): ContractDetail {
  const store = readStore();
  const createdAt = now();
  const contract: StoredContract = {
    ...payload.contract,
    id: payload.contract.id || id(),
    contacts: payload.contacts,
    payments: payload.payments,
    commissions: payload.commissions,
    createdAt,
    updatedAt: createdAt,
  };
  store.contracts.unshift(contract);
  writeStore(store);
  return mockGetContractDetail(contract.id);
}

export function mockUpdateContract(
  contractId: string,
  payload: ContractPayload,
): ContractDetail {
  const store = readStore();
  const index = store.contracts.findIndex((item) => item.id === contractId);
  if (index < 0) {
    throw new Error("合同不存在");
  }
  store.contracts[index] = {
    ...store.contracts[index],
    ...payload.contract,
    id: contractId,
    contacts: payload.contacts,
    payments: payload.payments,
    commissions: payload.commissions,
    updatedAt: now(),
  };
  writeStore(store);
  return mockGetContractDetail(contractId);
}

export function mockDeleteContract(contractId: string) {
  const store = readStore();
  const supplementIds = store.supplements
    .filter((item) => item.contractId === contractId)
    .map((item) => item.id);
  store.contracts = store.contracts.filter((item) => item.id !== contractId);
  store.supplements = store.supplements.filter((item) => item.contractId !== contractId);
  store.attachments = store.attachments.filter(
    (item) => item.bizId !== contractId && !supplementIds.includes(item.bizId),
  );
  writeStore(store);
}

export function mockListSupplements(contractId: string): SupplementListItem[] {
  const store = readStore();
  return store.supplements
    .filter((item) => item.contractId === contractId)
    .map((item) => supplementListItem(item, store));
}

export function mockGetSupplementDetail(supplementId: string): SupplementDetail {
  const store = readStore();
  const supplement = store.supplements.find((item) => item.id === supplementId);
  if (!supplement) {
    throw new Error("增补合同不存在");
  }
  return {
    ...supplementListItem(supplement, store),
    payments: supplement.payments,
    attachments: store.attachments.filter(
      (item) => item.bizType === "contract_supplement" && item.bizId === supplementId,
    ),
  };
}

export function mockCreateSupplement(
  contractId: string,
  payload: SupplementPayload,
): SupplementDetail {
  const store = readStore();
  const createdAt = now();
  const supplement: StoredSupplement = {
    ...payload.supplement,
    id: payload.supplement.id || id(),
    contractId,
    payments: payload.payments,
    createdAt,
    updatedAt: createdAt,
  };
  store.supplements.unshift(supplement);
  writeStore(store);
  return mockGetSupplementDetail(supplement.id);
}

export function mockUpdateSupplement(
  supplementId: string,
  payload: SupplementPayload,
): SupplementDetail {
  const store = readStore();
  const index = store.supplements.findIndex((item) => item.id === supplementId);
  if (index < 0) {
    throw new Error("增补合同不存在");
  }
  store.supplements[index] = {
    ...store.supplements[index],
    ...payload.supplement,
    id: supplementId,
    payments: payload.payments,
    updatedAt: now(),
  };
  writeStore(store);
  return mockGetSupplementDetail(supplementId);
}

export function mockDeleteSupplement(supplementId: string) {
  const store = readStore();
  store.supplements = store.supplements.filter((item) => item.id !== supplementId);
  store.attachments = store.attachments.filter((item) => item.bizId !== supplementId);
  writeStore(store);
}

export function mockListAttachments(
  bizType: AttachmentBizType,
  bizId: string,
  category: AttachmentCategory,
) {
  const store = readStore();
  return store.attachments.filter(
    (item) =>
      item.bizType === bizType &&
      item.bizId === bizId &&
      normalizeAttachmentCategory(item) === category,
  );
}

export function mockAddAttachment(
  bizType: AttachmentBizType,
  bizId: string,
  category: AttachmentCategory,
  sourcePath: string,
) {
  const store = readStore();
  if (!isValidAttachmentCategory(bizType, category)) {
    throw new Error("不支持的附件类型");
  }
  const name = sourcePath.split(/[\\/]/).pop() || "附件";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (!allowedAttachmentExtensions(category).includes(ext)) {
    throw new Error("附件格式不符合当前附件类型要求");
  }
  const createdAt = now();
  const record: AttachmentRecord = {
    id: `att_${id()}`,
    bizType,
    bizId,
    category,
    originalFileName: name,
    storedFileName: name,
    relativePath: `attachments/mock/${name}`,
    mimeType: ext === "pdf" ? "application/pdf" : null,
    createdAt,
  };
  store.attachments.push(record);
  writeStore(store);
  return record;
}

export function mockDeleteAttachment(attachmentId: string) {
  const store = readStore();
  store.attachments = store.attachments.filter((item) => item.id !== attachmentId);
  writeStore(store);
}

export function mockCreateBackup(description?: string | null): BackupInfo {
  const store = readStore();
  const createdAt = now();
  const backup: BackupInfo = {
    id: id(),
    backupType: "manual",
    fileName: `backup_${createdAt.replace(/:/g, "-")}.appbackup`,
    relativePath: "backups/manual",
    status: "created",
    description,
    createdAt,
  };
  store.backups.unshift(backup);
  writeStore(store);
  return backup;
}

export function mockListBackups() {
  return readStore().backups;
}

export function mockSystemInfo(): SystemInfo {
  return {
    dataRoot: "浏览器预览模式使用 localStorage；Tauri 桌面模式使用 MyAdminData",
    databaseFile: "MyAdminData/database/app.db",
    attachmentsDir: "MyAdminData/attachments",
    backupsDir: "MyAdminData/backups",
  };
}
