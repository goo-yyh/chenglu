import type { SupplementDetail, SupplementListItem, SupplementPayload } from "../types/supplement";
import {
  mockCreateSupplement,
  mockDeleteSupplement,
  mockGetSupplementDetail,
  mockListSupplements,
  mockUpdateSupplement,
} from "./mockStore";
import { invokeOrMock } from "./tauri";

export function listContractSupplements(contractId: string) {
  return invokeOrMock<SupplementListItem[]>(
    "list_contract_supplements",
    { contractId },
    () => mockListSupplements(contractId),
  );
}

export function getContractSupplementDetail(id: string) {
  return invokeOrMock<SupplementDetail>(
    "get_contract_supplement_detail",
    { id },
    () => mockGetSupplementDetail(id),
  );
}

export function createContractSupplement(contractId: string, input: SupplementPayload) {
  return invokeOrMock<SupplementDetail>(
    "create_contract_supplement",
    { contractId, input },
    () => mockCreateSupplement(contractId, input),
  );
}

export function updateContractSupplement(id: string, input: SupplementPayload) {
  return invokeOrMock<SupplementDetail>(
    "update_contract_supplement",
    { id, input },
    () => mockUpdateSupplement(id, input),
  );
}

export function deleteContractSupplement(id: string) {
  return invokeOrMock<void>(
    "delete_contract_supplement",
    { id },
    () => mockDeleteSupplement(id),
  );
}
