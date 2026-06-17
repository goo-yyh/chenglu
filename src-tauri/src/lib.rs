use chrono::{Datelike, Local};
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const APP_DATA_DIR_NAME: &str = "MyAdminData";
const LOGIN_ACCOUNT: &str = "chenglu";
const LOGIN_PASSWORD_SHA256: &str =
    "615ed7fb1504b0c724a296d7a69e6c7b2f9ea2c57c1d8206c5afdf392ebdfd25";

struct AppState {
    db: Mutex<Option<Connection>>,
    paths: AppPaths,
}

#[derive(Clone)]
struct AppPaths {
    root: PathBuf,
    database_dir: PathBuf,
    database_file: PathBuf,
    attachments_dir: PathBuf,
    backups_dir: PathBuf,
    logs_dir: PathBuf,
    temp_dir: PathBuf,
    config_file: PathBuf,
}

impl AppPaths {
    fn new() -> Result<Self, String> {
        let base = dirs::data_local_dir()
            .or_else(dirs::data_dir)
            .ok_or_else(|| "无法解析系统本地数据目录".to_string())?;
        let root = base.join(APP_DATA_DIR_NAME);
        Ok(Self {
            database_dir: root.join("database"),
            database_file: root.join("database").join("app.db"),
            attachments_dir: root.join("attachments"),
            backups_dir: root.join("backups"),
            logs_dir: root.join("logs"),
            temp_dir: root.join("temp"),
            config_file: root.join("config.json"),
            root,
        })
    }

    fn ensure_all_dirs(&self) -> Result<(), String> {
        fs::create_dir_all(&self.database_dir).map_err(to_string)?;
        fs::create_dir_all(self.attachments_dir.join("images")).map_err(to_string)?;
        fs::create_dir_all(self.attachments_dir.join("documents")).map_err(to_string)?;
        fs::create_dir_all(self.attachments_dir.join("excels")).map_err(to_string)?;
        fs::create_dir_all(self.attachments_dir.join("others")).map_err(to_string)?;
        fs::create_dir_all(self.attachments_dir.join("trash")).map_err(to_string)?;
        fs::create_dir_all(self.backups_dir.join("manual")).map_err(to_string)?;
        fs::create_dir_all(self.backups_dir.join("auto")).map_err(to_string)?;
        fs::create_dir_all(self.backups_dir.join("before_restore")).map_err(to_string)?;
        fs::create_dir_all(self.root.join("exports")).map_err(to_string)?;
        fs::create_dir_all(&self.logs_dir).map_err(to_string)?;
        fs::create_dir_all(&self.temp_dir).map_err(to_string)?;
        if !self.config_file.exists() {
            fs::write(
                &self.config_file,
                serde_json::to_string_pretty(&serde_json::json!({
                    "app_name": "合同管理",
                    "data_root": self.root.to_string_lossy()
                }))
                .map_err(to_string)?,
            )
            .map_err(to_string)?;
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginInput {
    account: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AttachmentRecord {
    id: String,
    biz_type: String,
    biz_id: String,
    category: String,
    original_file_name: String,
    stored_file_name: String,
    relative_path: String,
    mime_type: Option<String>,
    file_size: Option<i64>,
    sha256: Option<String>,
    created_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AttachmentSummary {
    count: i64,
    names: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ContractListItem {
    id: String,
    contract_date: String,
    project_name: String,
    owner_unit: String,
    contract_amount: f64,
    performance_bond_enabled: bool,
    performance_bond_amount: Option<f64>,
    performance_bond_type: Option<String>,
    performance_bond_return_due_at: Option<String>,
    performance_bond_returned: bool,
    warranty_bond_enabled: bool,
    warranty_bond_amount: Option<f64>,
    warranty_bond_type: Option<String>,
    warranty_bond_return_due_at: Option<String>,
    warranty_bond_returned: bool,
    paid_amount: f64,
    unpaid_amount: f64,
    supplement_count: i64,
    attachment_summary: AttachmentSummary,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContractListQuery {
    page: Option<usize>,
    page_size: Option<usize>,
    contract_date_start: Option<String>,
    contract_date_end: Option<String>,
    project_name: Option<String>,
    owner_unit: Option<String>,
    salesperson: Option<String>,
    performance_bond_returned: Option<bool>,
    warranty_bond_returned: Option<bool>,
    payment_settled: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ContractListResult {
    items: Vec<ContractListItem>,
    total: usize,
    page: usize,
    page_size: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ContractDetail {
    #[serde(flatten)]
    base: ContractListItem,
    contacts: Vec<ContactRecord>,
    payments: Vec<PaymentRecord>,
    commissions: Vec<CommissionRecord>,
    attachments: Vec<AttachmentRecord>,
    supplements: Vec<SupplementListItem>,
    total_amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ContractInput {
    id: Option<String>,
    contract_date: String,
    project_name: String,
    owner_unit: String,
    contract_amount: f64,
    performance_bond_enabled: bool,
    performance_bond_amount: Option<f64>,
    performance_bond_type: Option<String>,
    performance_bond_return_due_at: Option<String>,
    performance_bond_returned: bool,
    warranty_bond_enabled: bool,
    warranty_bond_amount: Option<f64>,
    warranty_bond_type: Option<String>,
    warranty_bond_return_due_at: Option<String>,
    warranty_bond_returned: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ContactRecord {
    id: Option<String>,
    name: Option<String>,
    phone: Option<String>,
    position: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PaymentRecord {
    id: Option<String>,
    amount: f64,
    paid_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CommissionRecord {
    id: Option<String>,
    salesperson: String,
    commission_amount: f64,
    commission_paid_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContractPayload {
    contract: ContractInput,
    contacts: Vec<ContactRecord>,
    payments: Vec<PaymentRecord>,
    commissions: Vec<CommissionRecord>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SupplementListItem {
    id: String,
    contract_id: String,
    supplement_amount: f64,
    supplement_date: String,
    paid_amount: f64,
    unpaid_amount: f64,
    attachment_summary: AttachmentSummary,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SupplementDetail {
    #[serde(flatten)]
    base: SupplementListItem,
    payments: Vec<PaymentRecord>,
    attachments: Vec<AttachmentRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SupplementInput {
    id: Option<String>,
    supplement_amount: f64,
    supplement_date: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SupplementPayload {
    supplement: SupplementInput,
    payments: Vec<PaymentRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupInfo {
    id: String,
    backup_type: String,
    file_name: String,
    relative_path: String,
    file_size: Option<i64>,
    sha256: Option<String>,
    status: String,
    description: Option<String>,
    created_at: String,
    restored_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemInfo {
    data_root: String,
    database_file: String,
    attachments_dir: String,
    backups_dir: String,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let paths = AppPaths::new().map_err(io_other)?;
            paths.ensure_all_dirs().map_err(io_other)?;
            let mut conn = open_database(&paths).map_err(io_other)?;
            run_migrations(&mut conn).map_err(io_other)?;
            app.manage(AppState {
                db: Mutex::new(Some(conn)),
                paths,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            validate_login,
            list_contracts,
            get_contract_detail,
            create_contract,
            update_contract,
            delete_contract,
            list_contract_supplements,
            get_contract_supplement_detail,
            create_contract_supplement,
            update_contract_supplement,
            delete_contract_supplement,
            add_attachment,
            list_attachments,
            open_attachment,
            delete_attachment,
            create_backup,
            list_local_backups,
            restore_backup,
            open_data_dir,
            get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn validate_login(input: LoginInput) -> Result<bool, String> {
    let password_hash = hex::encode(Sha256::digest(input.password.as_bytes()));
    Ok(input.account == LOGIN_ACCOUNT && password_hash == LOGIN_PASSWORD_SHA256)
}

#[tauri::command]
fn list_contracts(
    state: tauri::State<AppState>,
    query: ContractListQuery,
) -> Result<ContractListResult, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, contract_date, project_name, owner_unit, contract_amount,
                    performance_bond_enabled, performance_bond_amount, performance_bond_type,
                    performance_bond_return_due_at, performance_bond_returned,
                    warranty_bond_enabled, warranty_bond_amount, warranty_bond_type,
                    warranty_bond_return_due_at, warranty_bond_returned,
                    created_at, updated_at
             FROM contracts
             WHERE deleted_at IS NULL
             ORDER BY contract_date DESC, created_at DESC",
        )?;
        let bases = stmt
            .query_map([], contract_list_item_from_row)?
            .collect::<Result<Vec<_>, _>>()?;

        let mut filtered = Vec::new();
        for mut item in bases {
            enrich_contract_list_item(conn, &mut item)?;
            if matches_contract_list_query(conn, &item, &query)? {
                filtered.push(item);
            }
        }

        let page = query.page.unwrap_or(1).max(1);
        let page_size = query.page_size.unwrap_or(12).max(1);
        let total = filtered.len();
        let items = filtered
            .into_iter()
            .skip((page - 1) * page_size)
            .take(page_size)
            .collect();

        Ok(ContractListResult {
            items,
            total,
            page,
            page_size,
        })
    })
}

#[tauri::command]
fn get_contract_detail(
    state: tauri::State<AppState>,
    id: String,
) -> Result<ContractDetail, String> {
    with_conn(&state, |conn| contract_detail(conn, &id))
}

#[tauri::command]
fn create_contract(
    state: tauri::State<AppState>,
    input: ContractPayload,
) -> Result<ContractDetail, String> {
    validate_contract_payload(&input)?;
    let id = input
        .contract
        .id
        .clone()
        .unwrap_or_else(new_id);
    with_conn_mut(&state, |conn| {
        let tx = conn.transaction()?;
        insert_contract(&tx, &id, &input.contract)?;
        replace_contract_children(&tx, &id, &input)?;
        tx.commit()?;
        contract_detail(conn, &id)
    })
}

#[tauri::command]
fn update_contract(
    state: tauri::State<AppState>,
    id: String,
    input: ContractPayload,
) -> Result<ContractDetail, String> {
    validate_contract_payload(&input)?;
    with_conn_mut(&state, |conn| {
        let now = now_string();
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE contracts
             SET contract_date = ?1, project_name = ?2, owner_unit = ?3, contract_amount = ?4,
                 performance_bond_enabled = ?5, performance_bond_amount = ?6,
                 performance_bond_type = ?7, performance_bond_return_due_at = ?8,
                 performance_bond_returned = ?9, warranty_bond_enabled = ?10,
                 warranty_bond_amount = ?11, warranty_bond_type = ?12,
                 warranty_bond_return_due_at = ?13, warranty_bond_returned = ?14,
                 updated_at = ?15
             WHERE id = ?16 AND deleted_at IS NULL",
            params![
                input.contract.contract_date,
                input.contract.project_name.trim(),
                input.contract.owner_unit.trim(),
                input.contract.contract_amount,
                bool_int(input.contract.performance_bond_enabled),
                input.contract.performance_bond_amount,
                input.contract.performance_bond_type,
                input.contract.performance_bond_return_due_at,
                bool_int(input.contract.performance_bond_returned),
                bool_int(input.contract.warranty_bond_enabled),
                input.contract.warranty_bond_amount,
                input.contract.warranty_bond_type,
                input.contract.warranty_bond_return_due_at,
                bool_int(input.contract.warranty_bond_returned),
                now,
                id
            ],
        )?;
        soft_delete_contract_children(&tx, &id)?;
        replace_contract_children(&tx, &id, &input)?;
        tx.commit()?;
        contract_detail(conn, &id)
    })
}

#[tauri::command]
fn delete_contract(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    with_conn_mut(&state, |conn| {
        let now = now_string();
        let tx = conn.transaction()?;
        let supplement_ids = load_supplement_ids(&tx, &id)?;
        tx.execute(
            "UPDATE contracts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        soft_delete_contract_children(&tx, &id)?;
        for supplement_id in supplement_ids {
            soft_delete_supplement_children(&tx, &supplement_id)?;
            tx.execute(
                "UPDATE contract_supplements SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
                params![now, supplement_id],
            )?;
            tx.execute(
                "UPDATE attachments SET deleted_at = ?1 WHERE biz_type = 'contract_supplement' AND biz_id = ?2 AND deleted_at IS NULL",
                params![now, supplement_id],
            )?;
        }
        tx.execute(
            "UPDATE attachments SET deleted_at = ?1 WHERE biz_type = 'contract' AND biz_id = ?2 AND deleted_at IS NULL",
            params![now, id],
        )?;
        tx.commit()?;
        Ok(())
    })
}

#[tauri::command]
fn list_contract_supplements(
    state: tauri::State<AppState>,
    contract_id: String,
) -> Result<Vec<SupplementListItem>, String> {
    with_conn(&state, |conn| supplement_list(conn, &contract_id))
}

#[tauri::command]
fn get_contract_supplement_detail(
    state: tauri::State<AppState>,
    id: String,
) -> Result<SupplementDetail, String> {
    with_conn(&state, |conn| supplement_detail(conn, &id))
}

#[tauri::command]
fn create_contract_supplement(
    state: tauri::State<AppState>,
    contract_id: String,
    input: SupplementPayload,
) -> Result<SupplementDetail, String> {
    validate_supplement_payload(&input)?;
    let id = input
        .supplement
        .id
        .clone()
        .unwrap_or_else(new_id);
    with_conn_mut(&state, |conn| {
        let tx = conn.transaction()?;
        insert_supplement(&tx, &id, &contract_id, &input.supplement)?;
        replace_supplement_payments(&tx, &id, &input.payments)?;
        tx.commit()?;
        supplement_detail(conn, &id)
    })
}

#[tauri::command]
fn update_contract_supplement(
    state: tauri::State<AppState>,
    id: String,
    input: SupplementPayload,
) -> Result<SupplementDetail, String> {
    validate_supplement_payload(&input)?;
    with_conn_mut(&state, |conn| {
        let now = now_string();
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE contract_supplements
             SET supplement_amount = ?1, supplement_date = ?2, updated_at = ?3
             WHERE id = ?4 AND deleted_at IS NULL",
            params![
                input.supplement.supplement_amount,
                input.supplement.supplement_date,
                now,
                id
            ],
        )?;
        soft_delete_supplement_children(&tx, &id)?;
        replace_supplement_payments(&tx, &id, &input.payments)?;
        tx.commit()?;
        supplement_detail(conn, &id)
    })
}

#[tauri::command]
fn delete_contract_supplement(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    with_conn_mut(&state, |conn| {
        let now = now_string();
        let tx = conn.transaction()?;
        tx.execute(
            "UPDATE contract_supplements SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        soft_delete_supplement_children(&tx, &id)?;
        tx.execute(
            "UPDATE attachments SET deleted_at = ?1 WHERE biz_type = 'contract_supplement' AND biz_id = ?2 AND deleted_at IS NULL",
            params![now, id],
        )?;
        tx.commit()?;
        Ok(())
    })
}

#[tauri::command]
fn add_attachment(
    state: tauri::State<AppState>,
    biz_type: String,
    biz_id: String,
    category: String,
    source_path: String,
) -> Result<AttachmentRecord, String> {
    if biz_type != "contract" && biz_type != "contract_supplement" {
        return Err("不支持的附件业务类型".to_string());
    }
    let category = validate_attachment_category(&biz_type, &category)?;
    if biz_id.trim().is_empty() {
        return Err("附件缺少业务记录 ID".to_string());
    }
    if category != "invoice" {
        let existing_count = with_conn(&state, |conn| {
            active_attachment_count(conn, &biz_type, &biz_id, &category)
        })?;
        if existing_count > 0 {
            return Err("该附件类型只能上传 1 份，请先删除后再上传".to_string());
        }
    }

    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("选择的附件文件不存在".to_string());
    }

    let id = format!("att_{}", compact_id());
    let original_file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "无法读取附件文件名".to_string())?
        .to_string();
    let ext = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("bin")
        .to_lowercase();
    if ext != "pdf" {
        return Err("合同附件仅支持 PDF 格式".to_string());
    }
    let stored_file_name = format!("{id}.{ext}");
    let now = Local::now();
    let group = file_group(&ext);
    let relative_path = format!(
        "attachments/{}/{:04}/{:02}/{}",
        group,
        now.year(),
        now.month(),
        stored_file_name
    );
    let target = state.paths.root.join(&relative_path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }
    fs::copy(&source, &target).map_err(to_string)?;
    let file_size = fs::metadata(&target).ok().map(|m| m.len() as i64);
    let sha256 = sha256_file(&target).ok();
    let mime_type = mime_from_ext(&ext).map(str::to_string);
    let created_at = now_string();

    let record = AttachmentRecord {
        id,
        biz_type,
        biz_id,
        category,
        original_file_name,
        stored_file_name,
        relative_path,
        mime_type,
        file_size,
        sha256,
        created_at,
    };

    with_conn(&state, |conn| {
        conn.execute(
            "INSERT INTO attachments
             (id, biz_type, biz_id, category, original_file_name, stored_file_name,
              relative_path, mime_type, file_size, sha256, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                record.id,
                record.biz_type,
                record.biz_id,
                record.category,
                record.original_file_name,
                record.stored_file_name,
                record.relative_path,
                record.mime_type,
                record.file_size,
                record.sha256,
                record.created_at
            ],
        )?;
        Ok(record)
    })
}

#[tauri::command]
fn list_attachments(
    state: tauri::State<AppState>,
    biz_type: String,
    biz_id: String,
    category: String,
) -> Result<Vec<AttachmentRecord>, String> {
    let category = validate_attachment_category(&biz_type, &category)?;
    with_conn(&state, |conn| {
        list_attachments_for(conn, &biz_type, &biz_id, Some(&category))
    })
}

#[tauri::command]
fn open_attachment(state: tauri::State<AppState>, attachment_id: String) -> Result<(), String> {
    let relative_path = with_conn(&state, |conn| {
        conn.query_row(
            "SELECT relative_path FROM attachments WHERE id = ?1 AND deleted_at IS NULL",
            params![attachment_id],
            |row| row.get::<_, String>(0),
        )
    })?;
    let full_path = state.paths.root.join(relative_path);
    if !full_path.exists() {
        return Err("附件文件不存在".to_string());
    }
    open::that(full_path).map_err(to_string)
}

#[tauri::command]
fn delete_attachment(state: tauri::State<AppState>, attachment_id: String) -> Result<(), String> {
    let now = now_string();
    let relative_path = with_conn(&state, |conn| {
        conn.query_row(
            "SELECT relative_path FROM attachments WHERE id = ?1 AND deleted_at IS NULL",
            params![attachment_id.clone()],
            |row| row.get::<_, String>(0),
        )
        .optional()
    })?;
    if let Some(path) = relative_path {
        let source = state.paths.root.join(&path);
        if source.exists() {
            let trash_name = format!(
                "{}_{}",
                Local::now().format("%Y%m%d%H%M%S"),
                source.file_name().and_then(|v| v.to_str()).unwrap_or("attachment")
            );
            let target = state.paths.attachments_dir.join("trash").join(trash_name);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(to_string)?;
            }
            fs::rename(source, target).map_err(to_string)?;
        }
    }
    with_conn(&state, |conn| {
        conn.execute(
            "UPDATE attachments SET deleted_at = ?1 WHERE id = ?2",
            params![now, attachment_id],
        )?;
        Ok(())
    })
}

#[tauri::command]
fn create_backup(
    state: tauri::State<AppState>,
    description: Option<String>,
) -> Result<BackupInfo, String> {
    let guard = state.db.lock().map_err(|_| "数据库锁定失败".to_string())?;
    let conn = guard
        .as_ref()
        .ok_or_else(|| "数据库暂时不可用".to_string())?;
    create_backup_inner(conn, &state.paths, "manual", description)
}

#[tauri::command]
fn list_local_backups(state: tauri::State<AppState>) -> Result<Vec<BackupInfo>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, backup_type, file_name, relative_path, file_size, sha256,
                    status, description, created_at, restored_at
             FROM backup_records
             ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map([], backup_info_from_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    })
}

#[tauri::command]
fn restore_backup(state: tauri::State<AppState>, backup_path: String) -> Result<(), String> {
    let backup_path = PathBuf::from(backup_path);
    if !backup_path.is_file() {
        return Err("备份文件不存在".to_string());
    }

    {
        let mut guard = state.db.lock().map_err(|_| "数据库锁定失败".to_string())?;
        let conn = guard
            .as_mut()
            .ok_or_else(|| "数据库暂时不可用".to_string())?;
        create_backup_inner(
            conn,
            &state.paths,
            "before_restore",
            Some("恢复前自动备份".to_string()),
        )?;
        guard.take();
    }

    let restore_dir = state
        .paths
        .temp_dir
        .join(format!("restore_{}", Local::now().format("%Y%m%d%H%M%S")));
    if restore_dir.exists() {
        fs::remove_dir_all(&restore_dir).map_err(to_string)?;
    }
    fs::create_dir_all(&restore_dir).map_err(to_string)?;
    unzip_file(&backup_path, &restore_dir)?;

    let restored_db = restore_dir.join("database.sqlite");
    if !restored_db.is_file() {
        return Err("备份包缺少 database.sqlite".to_string());
    }

    fs::copy(&restored_db, &state.paths.database_file).map_err(to_string)?;
    let restored_attachments = restore_dir.join("attachments");
    if restored_attachments.exists() {
        if state.paths.attachments_dir.exists() {
            fs::remove_dir_all(&state.paths.attachments_dir).map_err(to_string)?;
        }
        copy_dir_recursive(&restored_attachments, &state.paths.attachments_dir)?;
    }
    state.paths.ensure_all_dirs()?;

    let mut conn = open_database(&state.paths)?;
    run_migrations(&mut conn)?;
    let mut guard = state.db.lock().map_err(|_| "数据库锁定失败".to_string())?;
    *guard = Some(conn);
    Ok(())
}

#[tauri::command]
fn open_data_dir(state: tauri::State<AppState>) -> Result<(), String> {
    open::that(&state.paths.root).map_err(to_string)
}

#[tauri::command]
fn get_system_info(state: tauri::State<AppState>) -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        data_root: state.paths.root.to_string_lossy().to_string(),
        database_file: state.paths.database_file.to_string_lossy().to_string(),
        attachments_dir: state.paths.attachments_dir.to_string_lossy().to_string(),
        backups_dir: state.paths.backups_dir.to_string_lossy().to_string(),
    })
}

fn with_conn<T, F>(state: &tauri::State<AppState>, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
{
    let guard = state.db.lock().map_err(|_| "数据库锁定失败".to_string())?;
    let conn = guard
        .as_ref()
        .ok_or_else(|| "数据库暂时不可用".to_string())?;
    f(conn).map_err(to_string)
}

fn with_conn_mut<T, F>(state: &tauri::State<AppState>, f: F) -> Result<T, String>
where
    F: FnOnce(&mut Connection) -> Result<T, rusqlite::Error>,
{
    let mut guard = state.db.lock().map_err(|_| "数据库锁定失败".to_string())?;
    let conn = guard
        .as_mut()
        .ok_or_else(|| "数据库暂时不可用".to_string())?;
    f(conn).map_err(to_string)
}

fn open_database(paths: &AppPaths) -> Result<Connection, String> {
    paths.ensure_all_dirs()?;
    let conn = Connection::open(&paths.database_file).map_err(to_string)?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(to_string)?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(to_string)?;
    conn.pragma_update(None, "busy_timeout", 5000)
        .map_err(to_string)?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(to_string)?;
    Ok(conn)
}

fn run_migrations(conn: &mut Connection) -> Result<(), String> {
    let migrations = [
        (1, "001_init", include_str!("../migrations/001_init.sql")),
        (
            2,
            "002_contracts",
            include_str!("../migrations/002_contracts.sql"),
        ),
        (
            3,
            "003_contract_supplements",
            include_str!("../migrations/003_contract_supplements.sql"),
        ),
        (
            4,
            "004_attachments",
            include_str!("../migrations/004_attachments.sql"),
        ),
        (
            5,
            "005_backups",
            include_str!("../migrations/005_backups.sql"),
        ),
        (
            6,
            "006_attachment_categories",
            include_str!("../migrations/006_attachment_categories.sql"),
        ),
    ];

    conn.execute_batch(migrations[0].2).map_err(to_string)?;
    for (version, name, sql) in migrations {
        let exists: Option<i64> = conn
            .query_row(
                "SELECT version FROM schema_migrations WHERE version = ?1",
                params![version],
                |row| row.get(0),
            )
            .optional()
            .map_err(to_string)?;
        if exists.is_none() {
            let tx = conn.transaction().map_err(to_string)?;
            tx.execute_batch(sql).map_err(to_string)?;
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
                params![version, name, now_string()],
            )
            .map_err(to_string)?;
            tx.commit().map_err(to_string)?;
        }
    }
    Ok(())
}

fn insert_contract(tx: &Transaction<'_>, id: &str, contract: &ContractInput) -> rusqlite::Result<()> {
    let now = now_string();
    tx.execute(
        "INSERT INTO contracts
         (id, contract_date, project_name, owner_unit, contract_amount,
          performance_bond_enabled, performance_bond_amount, performance_bond_type,
          performance_bond_return_due_at, performance_bond_returned,
          warranty_bond_enabled, warranty_bond_amount, warranty_bond_type,
          warranty_bond_return_due_at, warranty_bond_returned,
          created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16)",
        params![
            id,
            contract.contract_date,
            contract.project_name.trim(),
            contract.owner_unit.trim(),
            contract.contract_amount,
            bool_int(contract.performance_bond_enabled),
            contract.performance_bond_amount,
            contract.performance_bond_type,
            contract.performance_bond_return_due_at,
            bool_int(contract.performance_bond_returned),
            bool_int(contract.warranty_bond_enabled),
            contract.warranty_bond_amount,
            contract.warranty_bond_type,
            contract.warranty_bond_return_due_at,
            bool_int(contract.warranty_bond_returned),
            now
        ],
    )?;
    Ok(())
}

fn replace_contract_children(
    tx: &Transaction<'_>,
    contract_id: &str,
    input: &ContractPayload,
) -> rusqlite::Result<()> {
    let now = now_string();
    for (index, contact) in input.contacts.iter().enumerate() {
        if is_blank(contact.name.as_deref())
            && is_blank(contact.phone.as_deref())
            && is_blank(contact.position.as_deref())
        {
            continue;
        }
        tx.execute(
            "INSERT INTO contract_contacts
             (id, contract_id, name, phone, position, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![
                new_id(),
                contract_id,
                contact.name,
                contact.phone,
                contact.position,
                index as i64,
                now
            ],
        )?;
    }
    for (index, payment) in input.payments.iter().enumerate() {
        tx.execute(
            "INSERT INTO contract_payments
             (id, contract_id, amount, paid_at, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![
                new_id(),
                contract_id,
                payment.amount,
                payment.paid_at,
                index as i64,
                now
            ],
        )?;
    }
    for (index, commission) in input.commissions.iter().enumerate() {
        tx.execute(
            "INSERT INTO contract_commissions
             (id, contract_id, salesperson, commission_amount, commission_paid_at,
              sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![
                new_id(),
                contract_id,
                commission.salesperson.trim(),
                commission.commission_amount,
                commission.commission_paid_at,
                index as i64,
                now
            ],
        )?;
    }
    Ok(())
}

fn soft_delete_contract_children(tx: &Transaction<'_>, contract_id: &str) -> rusqlite::Result<()> {
    let now = now_string();
    tx.execute(
        "UPDATE contract_contacts SET deleted_at = ?1, updated_at = ?1 WHERE contract_id = ?2 AND deleted_at IS NULL",
        params![now, contract_id],
    )?;
    tx.execute(
        "UPDATE contract_payments SET deleted_at = ?1, updated_at = ?1 WHERE contract_id = ?2 AND deleted_at IS NULL",
        params![now, contract_id],
    )?;
    tx.execute(
        "UPDATE contract_commissions SET deleted_at = ?1, updated_at = ?1 WHERE contract_id = ?2 AND deleted_at IS NULL",
        params![now, contract_id],
    )?;
    Ok(())
}

fn insert_supplement(
    tx: &Transaction<'_>,
    id: &str,
    contract_id: &str,
    supplement: &SupplementInput,
) -> rusqlite::Result<()> {
    let now = now_string();
    tx.execute(
        "INSERT INTO contract_supplements
         (id, contract_id, supplement_amount, supplement_date, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![
            id,
            contract_id,
            supplement.supplement_amount,
            supplement.supplement_date,
            now
        ],
    )?;
    Ok(())
}

fn replace_supplement_payments(
    tx: &Transaction<'_>,
    supplement_id: &str,
    payments: &[PaymentRecord],
) -> rusqlite::Result<()> {
    let now = now_string();
    for (index, payment) in payments.iter().enumerate() {
        tx.execute(
            "INSERT INTO supplement_payments
             (id, supplement_id, amount, paid_at, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![
                new_id(),
                supplement_id,
                payment.amount,
                payment.paid_at,
                index as i64,
                now
            ],
        )?;
    }
    Ok(())
}

fn soft_delete_supplement_children(
    tx: &Transaction<'_>,
    supplement_id: &str,
) -> rusqlite::Result<()> {
    let now = now_string();
    tx.execute(
        "UPDATE supplement_payments SET deleted_at = ?1, updated_at = ?1 WHERE supplement_id = ?2 AND deleted_at IS NULL",
        params![now, supplement_id],
    )?;
    Ok(())
}

fn contract_detail(conn: &Connection, id: &str) -> rusqlite::Result<ContractDetail> {
    let mut base: ContractListItem = conn.query_row(
        "SELECT id, contract_date, project_name, owner_unit, contract_amount,
                performance_bond_enabled, performance_bond_amount, performance_bond_type,
                performance_bond_return_due_at, performance_bond_returned,
                warranty_bond_enabled, warranty_bond_amount, warranty_bond_type,
                warranty_bond_return_due_at, warranty_bond_returned,
                created_at, updated_at
         FROM contracts
         WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        contract_list_item_from_row,
    )?;
    enrich_contract_list_item(conn, &mut base)?;
    let supplements = supplement_list(conn, id)?;
    let supplement_total = supplements
        .iter()
        .map(|item| item.supplement_amount)
        .sum::<f64>();
    Ok(ContractDetail {
        total_amount: base.contract_amount + supplement_total,
        contacts: load_contacts(conn, id)?,
        payments: load_contract_payments(conn, id)?,
        commissions: load_commissions(conn, id)?,
        attachments: list_attachments_for(conn, "contract", id, None)?,
        supplements,
        base,
    })
}

fn supplement_detail(conn: &Connection, id: &str) -> rusqlite::Result<SupplementDetail> {
    let base = conn.query_row(
        "SELECT id, contract_id, supplement_amount, supplement_date, created_at, updated_at
         FROM contract_supplements
         WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |row| supplement_list_item_from_row(conn, row),
    )?;
    Ok(SupplementDetail {
        payments: load_supplement_payments(conn, id)?,
        attachments: list_attachments_for(conn, "contract_supplement", id, None)?,
        base,
    })
}

fn supplement_list(conn: &Connection, contract_id: &str) -> rusqlite::Result<Vec<SupplementListItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, contract_id, supplement_amount, supplement_date, created_at, updated_at
         FROM contract_supplements
         WHERE contract_id = ?1 AND deleted_at IS NULL
         ORDER BY supplement_date DESC, created_at DESC",
    )?;
    let rows = stmt
        .query_map(params![contract_id], |row| supplement_list_item_from_row(conn, row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn contract_list_item_from_row(row: &Row<'_>) -> rusqlite::Result<ContractListItem> {
    Ok(ContractListItem {
        id: row.get(0)?,
        contract_date: row.get(1)?,
        project_name: row.get(2)?,
        owner_unit: row.get(3)?,
        contract_amount: row.get(4)?,
        performance_bond_enabled: int_bool(row.get::<_, i64>(5)?),
        performance_bond_amount: row.get(6)?,
        performance_bond_type: row.get(7)?,
        performance_bond_return_due_at: row.get(8)?,
        performance_bond_returned: int_bool(row.get::<_, i64>(9)?),
        warranty_bond_enabled: int_bool(row.get::<_, i64>(10)?),
        warranty_bond_amount: row.get(11)?,
        warranty_bond_type: row.get(12)?,
        warranty_bond_return_due_at: row.get(13)?,
        warranty_bond_returned: int_bool(row.get::<_, i64>(14)?),
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
        paid_amount: 0.0,
        unpaid_amount: 0.0,
        supplement_count: 0,
        attachment_summary: AttachmentSummary {
            count: 0,
            names: Vec::new(),
        },
    })
}

fn supplement_list_item_from_row(
    conn: &Connection,
    row: &Row<'_>,
) -> rusqlite::Result<SupplementListItem> {
    let id: String = row.get(0)?;
    let amount: f64 = row.get(2)?;
    let paid_amount = sum_supplement_payments(conn, &id)?;
    Ok(SupplementListItem {
        id: id.clone(),
        contract_id: row.get(1)?,
        supplement_amount: amount,
        supplement_date: row.get(3)?,
        paid_amount,
        unpaid_amount: amount - paid_amount,
        attachment_summary: attachment_summary_for(conn, "contract_supplement", &id)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn enrich_contract_list_item(
    conn: &Connection,
    item: &mut ContractListItem,
) -> rusqlite::Result<()> {
    let paid = sum_contract_payments(conn, &item.id)?;
    item.paid_amount = paid;
    item.unpaid_amount = item.contract_amount - paid;
    item.supplement_count = count_contract_supplements(conn, &item.id)?;
    item.attachment_summary = attachment_summary_for(conn, "contract", &item.id)?;
    Ok(())
}

fn query_text(value: &Option<String>) -> Option<&str> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn contains_query_text(value: &str, keyword: &Option<String>) -> bool {
    let Some(keyword) = query_text(keyword) else {
        return true;
    };
    value.to_lowercase().contains(&keyword.to_lowercase())
}

fn matches_contract_list_query(
    conn: &Connection,
    item: &ContractListItem,
    query: &ContractListQuery,
) -> rusqlite::Result<bool> {
    if let Some(start) = query_text(&query.contract_date_start) {
        if item.contract_date.as_str() < start {
            return Ok(false);
        }
    }
    if let Some(end) = query_text(&query.contract_date_end) {
        if item.contract_date.as_str() > end {
            return Ok(false);
        }
    }
    if !contains_query_text(&item.project_name, &query.project_name) {
        return Ok(false);
    }
    if !contains_query_text(&item.owner_unit, &query.owner_unit) {
        return Ok(false);
    }
    if query_text(&query.salesperson).is_some() {
        let commissions = load_commissions(conn, &item.id)?;
        if !commissions
            .iter()
            .any(|commission| contains_query_text(&commission.salesperson, &query.salesperson))
        {
            return Ok(false);
        }
    }
    if let Some(returned) = query.performance_bond_returned {
        if !item.performance_bond_enabled || item.performance_bond_returned != returned {
            return Ok(false);
        }
    }
    if let Some(returned) = query.warranty_bond_returned {
        if !item.warranty_bond_enabled || item.warranty_bond_returned != returned {
            return Ok(false);
        }
    }
    if let Some(settled) = query.payment_settled {
        let item_settled = item.unpaid_amount <= 0.000001;
        if item_settled != settled {
            return Ok(false);
        }
    }
    Ok(true)
}

fn load_contacts(conn: &Connection, contract_id: &str) -> rusqlite::Result<Vec<ContactRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, phone, position
         FROM contract_contacts
         WHERE contract_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order ASC, created_at ASC",
    )?;
    let rows = stmt
        .query_map(params![contract_id], |row| {
        Ok(ContactRecord {
            id: Some(row.get(0)?),
            name: row.get(1)?,
            phone: row.get(2)?,
            position: row.get(3)?,
        })
    })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn load_contract_payments(
    conn: &Connection,
    contract_id: &str,
) -> rusqlite::Result<Vec<PaymentRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, amount, paid_at
         FROM contract_payments
         WHERE contract_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order ASC, created_at ASC",
    )?;
    let rows = stmt
        .query_map(params![contract_id], |row| {
        Ok(PaymentRecord {
            id: Some(row.get(0)?),
            amount: row.get(1)?,
            paid_at: row.get(2)?,
        })
    })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn load_supplement_payments(
    conn: &Connection,
    supplement_id: &str,
) -> rusqlite::Result<Vec<PaymentRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, amount, paid_at
         FROM supplement_payments
         WHERE supplement_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order ASC, created_at ASC",
    )?;
    let rows = stmt
        .query_map(params![supplement_id], |row| {
        Ok(PaymentRecord {
            id: Some(row.get(0)?),
            amount: row.get(1)?,
            paid_at: row.get(2)?,
        })
    })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn load_commissions(
    conn: &Connection,
    contract_id: &str,
) -> rusqlite::Result<Vec<CommissionRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, salesperson, commission_amount, commission_paid_at
         FROM contract_commissions
         WHERE contract_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order ASC, created_at ASC",
    )?;
    let rows = stmt
        .query_map(params![contract_id], |row| {
        Ok(CommissionRecord {
            id: Some(row.get(0)?),
            salesperson: row.get(1)?,
            commission_amount: row.get(2)?,
            commission_paid_at: row.get(3)?,
        })
    })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn list_attachments_for(
    conn: &Connection,
    biz_type: &str,
    biz_id: &str,
    category: Option<&str>,
) -> rusqlite::Result<Vec<AttachmentRecord>> {
    let category_expr =
        "COALESCE(category, CASE WHEN biz_type = 'contract_supplement' THEN 'supplement_file' ELSE 'contract_file' END)";
    if let Some(category) = category {
        let mut stmt = conn.prepare(&format!(
            "SELECT id, biz_type, biz_id, {category_expr}, original_file_name, stored_file_name,
                    relative_path, mime_type, file_size, sha256, created_at
             FROM attachments
             WHERE biz_type = ?1 AND biz_id = ?2 AND {category_expr} = ?3 AND deleted_at IS NULL
             ORDER BY created_at ASC"
        ))?;
        let rows = stmt
            .query_map(params![biz_type, biz_id, category], attachment_from_row)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(rows);
    }

    let mut stmt = conn.prepare(&format!(
        "SELECT id, biz_type, biz_id, {category_expr}, original_file_name, stored_file_name,
                relative_path, mime_type, file_size, sha256, created_at
         FROM attachments
         WHERE biz_type = ?1 AND biz_id = ?2 AND deleted_at IS NULL
         ORDER BY created_at ASC"
    ))?;
    let rows = stmt
        .query_map(params![biz_type, biz_id], attachment_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn attachment_from_row(row: &Row<'_>) -> rusqlite::Result<AttachmentRecord> {
    Ok(AttachmentRecord {
        id: row.get(0)?,
        biz_type: row.get(1)?,
        biz_id: row.get(2)?,
        category: row.get(3)?,
        original_file_name: row.get(4)?,
        stored_file_name: row.get(5)?,
        relative_path: row.get(6)?,
        mime_type: row.get(7)?,
        file_size: row.get(8)?,
        sha256: row.get(9)?,
        created_at: row.get(10)?,
    })
}

fn attachment_summary_for(
    conn: &Connection,
    biz_type: &str,
    biz_id: &str,
) -> rusqlite::Result<AttachmentSummary> {
    let attachments = list_attachments_for(conn, biz_type, biz_id, None)?;
    Ok(AttachmentSummary {
        count: attachments.len() as i64,
        names: attachments
            .into_iter()
            .map(|item| item.original_file_name)
            .collect(),
    })
}

fn active_attachment_count(
    conn: &Connection,
    biz_type: &str,
    biz_id: &str,
    category: &str,
) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(1)
         FROM attachments
         WHERE biz_type = ?1
           AND biz_id = ?2
           AND COALESCE(category, CASE WHEN biz_type = 'contract_supplement' THEN 'supplement_file' ELSE 'contract_file' END) = ?3
           AND deleted_at IS NULL",
        params![biz_type, biz_id, category],
        |row| row.get(0),
    )
}

fn validate_attachment_category(biz_type: &str, category: &str) -> Result<String, String> {
    let category = category.trim();
    let valid = match biz_type {
        "contract" => matches!(
            category,
            "contract_file" | "award_notice" | "acceptance_report" | "invoice"
        ),
        "contract_supplement" => category == "supplement_file",
        _ => false,
    };
    if valid {
        Ok(category.to_string())
    } else {
        Err("不支持的附件类型".to_string())
    }
}

fn sum_contract_payments(conn: &Connection, contract_id: &str) -> rusqlite::Result<f64> {
    conn.query_row(
        "SELECT COALESCE(SUM(amount), 0)
         FROM contract_payments
         WHERE contract_id = ?1 AND deleted_at IS NULL",
        params![contract_id],
        |row| row.get(0),
    )
}

fn count_contract_supplements(conn: &Connection, contract_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*)
         FROM contract_supplements
         WHERE contract_id = ?1 AND deleted_at IS NULL",
        params![contract_id],
        |row| row.get(0),
    )
}

fn sum_supplement_payments(conn: &Connection, supplement_id: &str) -> rusqlite::Result<f64> {
    conn.query_row(
        "SELECT COALESCE(SUM(amount), 0)
         FROM supplement_payments
         WHERE supplement_id = ?1 AND deleted_at IS NULL",
        params![supplement_id],
        |row| row.get(0),
    )
}

fn load_supplement_ids(tx: &Transaction<'_>, contract_id: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = tx.prepare(
        "SELECT id FROM contract_supplements WHERE contract_id = ?1 AND deleted_at IS NULL",
    )?;
    let rows = stmt
        .query_map(params![contract_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn validate_contract_payload(input: &ContractPayload) -> Result<(), String> {
    if input.contract.contract_date.trim().is_empty() {
        return Err("合同时间不能为空".to_string());
    }
    if input.contract.project_name.trim().is_empty() {
        return Err("项目名称不能为空".to_string());
    }
    if input.contract.owner_unit.trim().is_empty() {
        return Err("业主单位不能为空".to_string());
    }
    if input.contract.contract_amount < 0.0 {
        return Err("合同金额不能小于 0".to_string());
    }
    if input.contract.performance_bond_enabled {
        validate_non_negative(input.contract.performance_bond_amount, "履约保证金")?;
        if is_blank(input.contract.performance_bond_return_due_at.as_deref()) {
            return Err("履约保证金约定退还时间不能为空".to_string());
        }
    }
    if input.contract.warranty_bond_enabled {
        validate_non_negative(input.contract.warranty_bond_amount, "质保金")?;
        if is_blank(input.contract.warranty_bond_return_due_at.as_deref()) {
            return Err("质保金约定退还时间不能为空".to_string());
        }
    }
    for payment in &input.payments {
        if payment.amount < 0.0 {
            return Err("收款金额不能小于 0".to_string());
        }
        if payment.paid_at.trim().is_empty() {
            return Err("收款日期不能为空".to_string());
        }
    }
    for commission in &input.commissions {
        if commission.salesperson.trim().is_empty() {
            return Err("业务员不能为空".to_string());
        }
        if commission.commission_amount < 0.0 {
            return Err("提成不能小于 0".to_string());
        }
    }
    Ok(())
}

fn validate_supplement_payload(input: &SupplementPayload) -> Result<(), String> {
    if input.supplement.supplement_amount < 0.0 {
        return Err("增加合同金额不能小于 0".to_string());
    }
    if input.supplement.supplement_date.trim().is_empty() {
        return Err("增补合同日期不能为空".to_string());
    }
    for payment in &input.payments {
        if payment.amount < 0.0 {
            return Err("增补合同收款金额不能小于 0".to_string());
        }
        if payment.paid_at.trim().is_empty() {
            return Err("增补合同收款日期不能为空".to_string());
        }
    }
    Ok(())
}

fn create_backup_inner(
    conn: &Connection,
    paths: &AppPaths,
    backup_type: &str,
    description: Option<String>,
) -> Result<BackupInfo, String> {
    paths.ensure_all_dirs()?;
    let created_at = now_string();
    let timestamp = Local::now().format("%Y-%m-%d_%H%M%S");
    let id = new_id();
    let file_name = format!("backup_{timestamp}.appbackup");
    let folder = match backup_type {
        "before_restore" => paths.backups_dir.join("before_restore"),
        "auto" => paths.backups_dir.join("auto"),
        _ => paths.backups_dir.join("manual"),
    };
    fs::create_dir_all(&folder).map_err(to_string)?;
    let output = folder.join(&file_name);
    let temp_dir = paths.temp_dir.join(format!("backup_{timestamp}"));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(to_string)?;
    }
    fs::create_dir_all(&temp_dir).map_err(to_string)?;

    let db_snapshot = temp_dir.join("database.sqlite");
    let db_path = db_snapshot.to_string_lossy().replace('\'', "''");
    conn.execute_batch(&format!("VACUUM INTO '{db_path}'"))
        .map_err(to_string)?;

    let attachment_snapshot = temp_dir.join("attachments");
    if paths.attachments_dir.exists() {
        copy_dir_recursive(&paths.attachments_dir, &attachment_snapshot)?;
    } else {
        fs::create_dir_all(&attachment_snapshot).map_err(to_string)?;
    }
    if paths.config_file.exists() {
        fs::copy(&paths.config_file, temp_dir.join("config.json")).map_err(to_string)?;
    }
    fs::write(
        temp_dir.join("metadata.json"),
        serde_json::to_string_pretty(&serde_json::json!({
            "app_name": "合同管理",
            "app_version": "0.1.0",
            "backup_version": 1,
            "database_file": "database.sqlite",
            "created_at": created_at,
            "description": description,
            "contains_attachments": true
        }))
        .map_err(to_string)?,
    )
    .map_err(to_string)?;

    zip_dir(&temp_dir, &output)?;
    let file_size = fs::metadata(&output).ok().map(|m| m.len() as i64);
    let sha256 = sha256_file(&output).ok();
    let relative_path = output
        .strip_prefix(&paths.root)
        .unwrap_or(&output)
        .to_string_lossy()
        .to_string();

    conn.execute(
        "INSERT INTO backup_records
         (id, backup_type, file_name, relative_path, file_size, sha256, app_version,
          database_version, status, description, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '0.1.0', 5, 'created', ?7, ?8)",
        params![
            id,
            backup_type,
            file_name,
            relative_path,
            file_size,
            sha256,
            description,
            created_at
        ],
    )
    .map_err(to_string)?;
    let _ = fs::remove_dir_all(&temp_dir);

    Ok(BackupInfo {
        id,
        backup_type: backup_type.to_string(),
        file_name,
        relative_path,
        file_size,
        sha256,
        status: "created".to_string(),
        description,
        created_at,
        restored_at: None,
    })
}

fn backup_info_from_row(row: &Row<'_>) -> rusqlite::Result<BackupInfo> {
    Ok(BackupInfo {
        id: row.get(0)?,
        backup_type: row.get(1)?,
        file_name: row.get(2)?,
        relative_path: row.get(3)?,
        file_size: row.get(4)?,
        sha256: row.get(5)?,
        status: row.get(6)?,
        description: row.get(7)?,
        created_at: row.get(8)?,
        restored_at: row.get(9)?,
    })
}

fn zip_dir(source: &Path, output: &Path) -> Result<(), String> {
    let file = File::create(output).map_err(to_string)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    for entry in WalkDir::new(source) {
        let entry = entry.map_err(to_string)?;
        let path = entry.path();
        let name = path
            .strip_prefix(source)
            .map_err(to_string)?
            .to_string_lossy()
            .replace('\\', "/");
        if name.is_empty() {
            continue;
        }
        if path.is_dir() {
            zip.add_directory(format!("{name}/"), options)
                .map_err(to_string)?;
        } else {
            zip.start_file(name, options).map_err(to_string)?;
            let mut input = File::open(path).map_err(to_string)?;
            io::copy(&mut input, &mut zip).map_err(to_string)?;
        }
    }
    zip.finish().map_err(to_string)?;
    Ok(())
}

fn unzip_file(source: &Path, target: &Path) -> Result<(), String> {
    let file = File::open(source).map_err(to_string)?;
    let mut archive = ZipArchive::new(file).map_err(to_string)?;
    for index in 0..archive.len() {
        let mut item = archive.by_index(index).map_err(to_string)?;
        let Some(enclosed) = item.enclosed_name() else {
            continue;
        };
        let output = target.join(enclosed);
        if item.is_dir() {
            fs::create_dir_all(&output).map_err(to_string)?;
        } else {
            if let Some(parent) = output.parent() {
                fs::create_dir_all(parent).map_err(to_string)?;
            }
            let mut output_file = File::create(&output).map_err(to_string)?;
            io::copy(&mut item, &mut output_file).map_err(to_string)?;
        }
    }
    Ok(())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(to_string)?;
    for entry in WalkDir::new(source) {
        let entry = entry.map_err(to_string)?;
        let path = entry.path();
        let relative = path.strip_prefix(source).map_err(to_string)?;
        let destination = target.join(relative);
        if path.is_dir() {
            fs::create_dir_all(&destination).map_err(to_string)?;
        } else {
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(to_string)?;
            }
            fs::copy(path, destination).map_err(to_string)?;
        }
    }
    Ok(())
}

fn sha256_file(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn file_group(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" => "images",
        "doc" | "docx" | "pdf" | "txt" | "rtf" => "documents",
        "xls" | "xlsx" | "csv" => "excels",
        _ => "others",
    }
}

fn mime_from_ext(ext: &str) -> Option<&'static str> {
    match ext {
        "pdf" => Some("application/pdf"),
        "doc" => Some("application/msword"),
        "docx" => Some("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "xls" => Some("application/vnd.ms-excel"),
        "xlsx" => Some("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        "csv" => Some("text/csv"),
        "txt" => Some("text/plain"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

fn validate_non_negative(value: Option<f64>, label: &str) -> Result<(), String> {
    match value {
        Some(amount) if amount >= 0.0 => Ok(()),
        Some(_) => Err(format!("{label}不能小于 0")),
        None => Err(format!("{label}不能为空")),
    }
}

fn is_blank(value: Option<&str>) -> bool {
    value.map(|text| text.trim().is_empty()).unwrap_or(true)
}

fn bool_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn int_bool(value: i64) -> bool {
    value != 0
}

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn compact_id() -> String {
    Uuid::new_v4().simple().to_string()
}

fn now_string() -> String {
    Local::now().to_rfc3339()
}

fn to_string<E: std::fmt::Display>(error: E) -> String {
    error.to_string()
}

fn io_other(message: String) -> io::Error {
    io::Error::new(io::ErrorKind::Other, message)
}
