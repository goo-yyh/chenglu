import type {
  ContractDetail,
  ContractListQuery,
  ContractListResult,
  ContractPayload,
} from "../types/contract";
import {
  mockCreateContract,
  mockDeleteContract,
  mockGetContractDetail,
  mockListContracts,
  mockUpdateContract,
} from "./mockStore";
import { invokeOrMock } from "./tauri";

export function listContracts(query: ContractListQuery) {
  return invokeOrMock<ContractListResult>(
    "list_contracts",
    { query },
    () => mockListContracts(query),
  );
}

export function getContractDetail(id: string) {
  return invokeOrMock<ContractDetail>(
    "get_contract_detail",
    { id },
    () => mockGetContractDetail(id),
  );
}

export function createContract(input: ContractPayload) {
  return invokeOrMock<ContractDetail>(
    "create_contract",
    { input },
    () => mockCreateContract(input),
  );
}

export function updateContract(id: string, input: ContractPayload) {
  return invokeOrMock<ContractDetail>(
    "update_contract",
    { id, input },
    () => mockUpdateContract(id, input),
  );
}

export function deleteContract(id: string) {
  return invokeOrMock<void>("delete_contract", { id }, () => mockDeleteContract(id));
}
