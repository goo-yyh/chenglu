# 合同管理后台设计文档

## 1. 设计目标

本文档基于 `specs/0001_design.md` 的总体架构，并结合 `specs/0002_demand.md` 的业务需求，重新收敛第一版合同管理后台的技术设计。

第一版采用：

- Tauri 2 桌面应用
- React + TypeScript 前端
- Ant Design 组件库
- Rust command 本地业务层
- SQLite 本地数据库
- 本地固定数据目录
- 本地附件目录
- 本地备份与恢复能力

系统运行在 Windows 和 macOS 本地电脑上，不依赖云端、不依赖线上后端服务。

## 2. 总体架构

```text
┌─────────────────────────────────────────────┐
│ Tauri 2 桌面应用                             │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ React + TypeScript + Ant Design 前端     │ │
│ │ - 登录页                                 │ │
│ │ - 后台布局                               │ │
│ │ - 合同管理表格                           │ │
│ │ - 合同表单 / 详情                        │ │
│ │ - 增补合同表单 / 详情                    │ │
│ └──────────────────────┬──────────────────┘ │
│                        │ invoke             │
│ ┌──────────────────────▼──────────────────┐ │
│ │ Rust command 本地业务层                   │ │
│ │ - 登录校验                               │ │
│ │ - 合同 CRUD                              │ │
│ │ - 增补合同 CRUD                          │ │
│ │ - 金额汇总                               │ │
│ │ - 附件复制 / 打开 / 删除                 │ │
│ │ - SQLite 事务                            │ │
│ │ - 备份恢复                               │ │
│ └──────────────────────┬──────────────────┘ │
│                        │                    │
│ ┌──────────────────────▼──────────────────┐ │
│ │ 本地数据目录                             │ │
│ │ - database/app.db                        │ │
│ │ - attachments/                           │ │
│ │ - backups/                               │ │
│ │ - logs/                                  │ │
│ │ - config.json                            │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## 3. 与原架构设计的关系

`0001_design.md` 中的通用客户、商品、订单示例不作为第一版业务范围。

本设计保留原架构中的以下原则：

- 使用 Tauri 2 打包桌面应用。
- 前端只负责界面，不直接读写 SQLite 和文件系统。
- 业务数据、附件、备份、日志都保存在本机固定数据目录。
- 数据库使用 SQLite，并启用 migration。
- 附件复制到应用数据目录，数据库只保存相对路径。
- 删除优先软删除。
- 备份恢复使用本地 `.appbackup` 包。
- 应用建议单实例运行。

本设计对原架构做以下业务化调整：

- 前端技术栈固定为 React + TypeScript + Ant Design。
- 第一版业务模块固定为合同管理。
- 检测报告管理只保留菜单占位。
- 增加本地登录页，但不引入多用户账号系统。

## 4. 前端页面设计

### 4.1 路由结构

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/login` | 登录页 | 未登录时默认进入 |
| `/contracts` | 合同管理 | 登录后默认进入 |
| `/inspection-reports` | 检测报告管理 | 第一版空状态占位 |

所有后台页面都需要登录后访问。

### 4.2 后台布局

后台布局使用 Ant Design 的 Layout、Sider、Menu、Header、Content。

左侧菜单固定包含：

| 菜单 key | 文案 | 路由 |
| --- | --- | --- |
| `contracts` | 合同管理 | `/contracts` |
| `inspection-reports` | 检测报告管理 | `/inspection-reports` |

登录成功后默认跳转 `/contracts`，菜单默认选中“合同管理”。

### 4.3 登录页

登录页使用 Ant Design Form。

字段：

| 字段 | 组件 | 规则 |
| --- | --- | --- |
| 账号 | Input | 必填 |
| 密码 | Input.Password | 必填 |

登录按钮点击后调用 Rust command 做本地校验。

第一版只有固定账号：

```text
账号：chenglu
密码：88888888
```

登录成功后，前端记录当前会话状态并跳转合同管理页。

### 4.4 合同管理页

合同管理页由顶部工具栏和合同表格组成。

顶部工具栏：

| 控件 | 说明 |
| --- | --- |
| 添加合同按钮 | 打开新增合同表单 |

合同表格使用 Ant Design Table。

主表字段：

| 字段 | 数据来源 |
| --- | --- |
| 时间 | `contracts.contract_date` |
| 项目名称 | `contracts.project_name` |
| 业主单位 | `contracts.owner_unit` |
| 合同金额 | `contracts.contract_amount` |
| 履约保证金 | `contracts.performance_bond_amount` 或无 |
| 履约保证金形式 | `contracts.performance_bond_type` |
| 履约保证金退还时间 | `contracts.performance_bond_return_due_at`，约定退还时间 |
| 质保金 | `contracts.warranty_bond_amount` 或无 |
| 质保金形式 | `contracts.warranty_bond_type` |
| 质保金退还时间 | `contracts.warranty_bond_return_due_at`，约定退还时间 |
| 合同附件 | `attachments` 聚合结果 |
| 已收款金额 | `contract_payments` 金额合计 |
| 未收款金额 | `contract_amount - 已收款金额` |
| 操作 | 编辑、查看详情、删除、增补合同 |

表格行支持展开。展开区域展示当前合同的增补合同表格。

### 4.5 合同表单

合同新增和编辑共用同一套表单。

由于字段较多，建议使用 Drawer 或独立页面承载，内部按模块分区：

| 区域 | 内容 |
| --- | --- |
| 基础信息 | 时间、项目名称、业主单位、合同金额、合同附件 |
| 经办人 | 可编辑子表格 |
| 履约保证金 | 开关、金额、形式、约定退还时间、是否退还 |
| 质保金 | 开关、金额、形式、约定退还时间、是否退还 |
| 收款记录 | 可编辑子表格 |
| 业务员提成 | 可编辑子表格 |

经办人、收款记录、业务员提成建议在前端表单中作为数组字段维护，提交时作为合同聚合对象一次性传给 Rust command。

### 4.6 合同详情

合同详情为只读视图。

展示内容需要覆盖合同表单中的所有模块，并额外展示当前合同下的增补合同列表。

### 4.7 增补合同表格

增补合同表格展示在合同主表的展开区域中。

字段：

| 字段 | 数据来源 |
| --- | --- |
| 增加合同金额 | `contract_supplements.supplement_amount` |
| 增补合同日期 | `contract_supplements.supplement_date` |
| 增补合同附件 | `attachments` 聚合结果 |
| 增补合同收款金额 | `supplement_payments` 金额合计 |
| 未收款金额 | `supplement_amount - 增补合同收款金额` |
| 操作 | 编辑、查看详情、删除 |

### 4.8 增补合同表单

增补合同新增和编辑共用同一套表单。

字段区域：

| 区域 | 内容 |
| --- | --- |
| 基础信息 | 增加合同金额、增补合同日期、增补合同附件 |
| 收款记录 | 可编辑子表格，字段为收款金额、收款日期 |

增补合同必须关联一个主合同。

## 5. 数据模型设计

### 5.1 通用字段

核心业务表统一包含：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键，UUID 或 ULID |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |
| `deleted_at` | 软删除时间 |

### 5.2 合同表 `contracts`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT | 主键 |
| `contract_date` | TEXT | 时间 |
| `project_name` | TEXT | 项目名称 |
| `owner_unit` | TEXT | 业主单位 |
| `contract_amount` | REAL | 初始合同金额，不含增补合同 |
| `performance_bond_enabled` | INTEGER | 是否有履约保证金 |
| `performance_bond_amount` | REAL | 履约保证金金额 |
| `performance_bond_type` | TEXT | 履约保证金形式 |
| `performance_bond_return_due_at` | TEXT | 履约保证金约定退还时间 |
| `performance_bond_returned` | INTEGER | 是否已经退还 |
| `warranty_bond_enabled` | INTEGER | 是否有质保金 |
| `warranty_bond_amount` | REAL | 质保金金额 |
| `warranty_bond_type` | TEXT | 质保金形式 |
| `warranty_bond_return_due_at` | TEXT | 质保金约定退还时间 |
| `warranty_bond_returned` | INTEGER | 是否已经退还 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |
| `deleted_at` | TEXT | 软删除时间 |

### 5.3 经办人表 `contract_contacts`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT | 主键 |
| `contract_id` | TEXT | 所属合同 |
| `name` | TEXT | 经办人姓名 |
| `phone` | TEXT | 经办人电话 |
| `position` | TEXT | 经办人职位 |
| `sort_order` | INTEGER | 排序 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |
| `deleted_at` | TEXT | 软删除时间 |

### 5.4 合同收款表 `contract_payments`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT | 主键 |
| `contract_id` | TEXT | 所属合同 |
| `amount` | REAL | 收款金额 |
| `paid_at` | TEXT | 收款日期 |
| `sort_order` | INTEGER | 排序 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |
| `deleted_at` | TEXT | 软删除时间 |

### 5.5 业务员提成表 `contract_commissions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT | 主键 |
| `contract_id` | TEXT | 所属合同 |
| `salesperson` | TEXT | 业务员 |
| `commission_amount` | REAL | 提成金额 |
| `commission_paid_at` | TEXT | 提成付款时间 |
| `sort_order` | INTEGER | 排序 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |
| `deleted_at` | TEXT | 软删除时间 |

### 5.6 增补合同表 `contract_supplements`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT | 主键 |
| `contract_id` | TEXT | 所属主合同 |
| `supplement_amount` | REAL | 增加合同金额 |
| `supplement_date` | TEXT | 增补合同日期 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |
| `deleted_at` | TEXT | 软删除时间 |

### 5.7 增补合同收款表 `supplement_payments`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT | 主键 |
| `supplement_id` | TEXT | 所属增补合同 |
| `amount` | REAL | 收款金额 |
| `paid_at` | TEXT | 收款日期 |
| `sort_order` | INTEGER | 排序 |
| `created_at` | TEXT | 创建时间 |
| `updated_at` | TEXT | 更新时间 |
| `deleted_at` | TEXT | 软删除时间 |

### 5.8 附件表 `attachments`

沿用 `0001_design.md` 的附件表设计，并通过 `biz_type` 区分业务类型。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | TEXT | 主键 |
| `biz_type` | TEXT | 业务类型 |
| `biz_id` | TEXT | 业务记录 ID |
| `original_file_name` | TEXT | 原始文件名 |
| `stored_file_name` | TEXT | 存储文件名 |
| `relative_path` | TEXT | 相对数据目录路径 |
| `mime_type` | TEXT | 文件类型 |
| `file_size` | INTEGER | 文件大小 |
| `sha256` | TEXT | 文件校验值 |
| `created_at` | TEXT | 创建时间 |
| `deleted_at` | TEXT | 软删除时间 |

业务类型取值：

| biz_type | 说明 |
| --- | --- |
| `contract` | 主合同附件 |
| `contract_supplement` | 增补合同附件 |

## 6. 金额聚合设计

### 6.1 合同列表聚合字段

合同列表不单独存储已收款金额和未收款金额，而是在查询时聚合。

| 字段 | 计算规则 |
| --- | --- |
| 合同已收款金额 | 当前合同未删除收款记录金额合计 |
| 合同未收款金额 | 合同金额 - 合同已收款金额 |

合同列表中的金额只针对初始合同，不包含增补合同。

### 6.2 增补合同列表聚合字段

| 字段 | 计算规则 |
| --- | --- |
| 增补合同收款金额 | 当前增补合同未删除收款记录金额合计 |
| 增补合同未收款金额 | 增加合同金额 - 增补合同收款金额 |

### 6.3 总合同金额

详情页可以展示总合同金额，计算规则为：

```text
总合同金额 = 初始合同金额 + 所有未删除增补合同的增加合同金额合计
```

该字段用于详情展示，不替代合同列表中的“合同金额”。

## 7. Rust command 设计

### 7.1 登录

| command | 说明 |
| --- | --- |
| `validate_login` | 校验账号和密码 |

登录校验在 Rust 侧完成，前端不直接保存密码校验逻辑。

第一版是本地单用户登录，不需要用户表、角色表和权限表。

### 7.2 合同管理

| command | 说明 |
| --- | --- |
| `list_contracts` | 分页查询合同列表，返回聚合金额和附件摘要 |
| `get_contract_detail` | 获取合同完整详情 |
| `create_contract` | 创建合同及其经办人、收款、提成记录 |
| `update_contract` | 更新合同及其经办人、收款、提成记录 |
| `delete_contract` | 软删除合同 |

创建和更新合同需要使用 SQLite transaction，保证主合同、经办人、收款记录、提成记录同时成功或同时失败。

### 7.3 增补合同管理

| command | 说明 |
| --- | --- |
| `list_contract_supplements` | 查询某个合同下的增补合同列表 |
| `get_contract_supplement_detail` | 获取增补合同详情 |
| `create_contract_supplement` | 创建增补合同及其收款记录 |
| `update_contract_supplement` | 更新增补合同及其收款记录 |
| `delete_contract_supplement` | 软删除增补合同 |

创建和更新增补合同也需要使用 SQLite transaction。

### 7.4 附件管理

沿用 `0001_design.md` 的附件 command：

| command | 说明 |
| --- | --- |
| `add_attachment` | 复制本地文件到应用附件目录，并写入附件记录 |
| `list_attachments` | 查询业务记录的附件 |
| `open_attachment` | 使用系统默认程序打开附件 |
| `delete_attachment` | 软删除附件，并将文件移动到 trash |

### 7.5 系统能力

沿用 `0001_design.md` 的系统能力：

| command | 说明 |
| --- | --- |
| `create_backup` | 创建本地备份 |
| `list_local_backups` | 查询本地备份列表 |
| `restore_backup` | 从备份恢复 |
| `open_data_dir` | 打开本地数据目录 |
| `get_system_info` | 获取系统信息 |

## 8. 表单提交设计

### 8.1 合同表单提交结构

合同表单在前端维护一个聚合对象：

| 字段 | 说明 |
| --- | --- |
| `contract` | 合同基础信息和保证金信息 |
| `contacts` | 经办人数组 |
| `payments` | 初始合同收款记录数组 |
| `commissions` | 业务员提成数组 |
| `attachment_ids` | 合同附件 ID 数组 |

提交时一次性调用创建或更新 command。

### 8.2 增补合同表单提交结构

增补合同表单在前端维护：

| 字段 | 说明 |
| --- | --- |
| `supplement` | 增补合同基础信息 |
| `payments` | 增补合同收款记录数组 |
| `attachment_ids` | 增补合同附件 ID 数组 |

提交时一次性调用创建或更新 command。

## 9. 附件存储设计

附件处理完全沿用 `0001_design.md`：

```text
用户选择本地文件
        ↓
前端传递文件路径给 Rust command
        ↓
Rust 复制文件到 MyAdminData/attachments/
        ↓
数据库保存附件相对路径
        ↓
前端展示附件名称、数量或打开入口
```

附件保存目录按文件类型和年月分组：

```text
attachments/images/YYYY/MM/
attachments/documents/YYYY/MM/
attachments/excels/YYYY/MM/
attachments/others/YYYY/MM/
```

删除附件时先软删除数据库记录，并将文件移动到 `attachments/trash/`。

## 10. 数据库初始化与迁移

SQLite 初始化参数沿用 `0001_design.md`：

```text
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

第一版建议 migration：

| 文件 | 内容 |
| --- | --- |
| `001_init.sql` | `schema_migrations`、基础配置表 |
| `002_contracts.sql` | 合同、经办人、合同收款、业务员提成 |
| `003_contract_supplements.sql` | 增补合同、增补合同收款 |
| `004_attachments.sql` | 附件表 |
| `005_backups.sql` | 备份记录表 |

## 11. 校验规则

### 11.1 合同校验

| 字段 | 规则 |
| --- | --- |
| 时间 | 必填 |
| 项目名称 | 必填 |
| 业主单位 | 必填 |
| 合同金额 | 必填，数字，不能小于 0 |
| 履约保证金金额 | 开关开启时校验，数字，不能小于 0 |
| 履约保证金退还时间 | 开关开启时必填，表示约定退还时间，不与是否已退还联动 |
| 质保金金额 | 开关开启时校验，数字，不能小于 0 |
| 质保金退还时间 | 开关开启时必填，表示约定退还时间，不与是否已退还联动 |

### 11.2 子表校验

| 子表 | 规则 |
| --- | --- |
| 经办人 | 姓名、电话、职位至少填写一项；已填写的行才保存 |
| 合同收款 | 金额和收款日期必须同时填写 |
| 业务员提成 | 业务员和提成必须同时填写；付款时间可为空 |
| 增补合同收款 | 金额和收款日期必须同时填写 |

### 11.3 增补合同校验

| 字段 | 规则 |
| --- | --- |
| 增加合同金额 | 必填，数字，不能小于 0 |
| 增补合同日期 | 必填 |

## 12. 删除设计

### 12.1 删除合同

删除合同使用软删除：

- 设置 `contracts.deleted_at`
- 逻辑删除该合同的经办人、收款记录、业务员提成
- 逻辑删除该合同下的增补合同和增补合同收款记录
- 逻辑删除合同附件和增补合同附件

### 12.2 删除增补合同

删除增补合同使用软删除：

- 设置 `contract_supplements.deleted_at`
- 逻辑删除该增补合同的收款记录
- 逻辑删除该增补合同附件

### 12.3 删除确认

前端删除合同和增补合同时使用 Ant Design Popconfirm 或 Modal 二次确认。

## 13. 前端目录建议

```text
src/
├─ app/
│  ├─ router.tsx
│  └─ App.tsx
│
├─ layouts/
│  └─ AdminLayout.tsx
│
├─ pages/
│  ├─ LoginPage.tsx
│  ├─ contracts/
│  │  ├─ ContractListPage.tsx
│  │  ├─ ContractFormDrawer.tsx
│  │  ├─ ContractDetailDrawer.tsx
│  │  ├─ SupplementTable.tsx
│  │  ├─ SupplementFormDrawer.tsx
│  │  └─ SupplementDetailDrawer.tsx
│  └─ inspectionReports/
│     └─ InspectionReportsPage.tsx
│
├─ components/
│  ├─ EditableRowsTable.tsx
│  ├─ AttachmentList.tsx
│  └─ MoneyText.tsx
│
├─ services/
│  ├─ authApi.ts
│  ├─ contractApi.ts
│  ├─ supplementApi.ts
│  └─ attachmentApi.ts
│
├─ types/
│  ├─ auth.ts
│  ├─ contract.ts
│  ├─ supplement.ts
│  └─ attachment.ts
│
└─ utils/
   ├─ money.ts
   └─ date.ts
```

## 14. Rust 目录建议

```text
src-tauri/
├─ src/
│  ├─ main.rs
│  ├─ commands/
│  │  ├─ auth_commands.rs
│  │  ├─ contract_commands.rs
│  │  ├─ supplement_commands.rs
│  │  ├─ attachment_commands.rs
│  │  ├─ backup_commands.rs
│  │  └─ system_commands.rs
│  ├─ db/
│  │  ├─ connection.rs
│  │  ├─ migrations.rs
│  │  └─ transaction.rs
│  ├─ services/
│  │  ├─ auth_service.rs
│  │  ├─ contract_service.rs
│  │  ├─ supplement_service.rs
│  │  ├─ attachment_service.rs
│  │  ├─ backup_service.rs
│  │  └─ system_service.rs
│  ├─ models/
│  │  ├─ contract.rs
│  │  ├─ supplement.rs
│  │  ├─ attachment.rs
│  │  └─ backup.rs
│  └─ utils/
│     ├─ paths.rs
│     ├─ checksum.rs
│     ├─ file_type.rs
│     └─ time.rs
└─ migrations/
   ├─ 001_init.sql
   ├─ 002_contracts.sql
   ├─ 003_contract_supplements.sql
   ├─ 004_attachments.sql
   └─ 005_backups.sql
```

## 15. 本地登录设计

第一版登录是本地应用进入门槛，不是完整账号体系。

设计原则：

- 不建立用户管理页面。
- 不建立角色权限。
- 不支持修改密码。
- 登录校验放在 Rust 侧。
- 前端只保存当前运行会话的登录状态。

建议不要把明文密码校验写在前端代码中。Rust 侧可以保存密码哈希并校验输入密码。

## 16. 备份恢复与数据目录

沿用 `0001_design.md` 的本地数据目录：

```text
Windows:
%LOCALAPPDATA%\MyAdminData\

macOS:
~/Library/Application Support/MyAdminData/
```

目录结构：

```text
MyAdminData/
├─ database/
│  └─ app.db
├─ attachments/
├─ backups/
├─ exports/
├─ logs/
├─ temp/
└─ config.json
```

备份恢复仍然以完整本地数据为单位，不使用 Excel 作为主备份格式。

## 17. 第一版开发顺序

建议按以下顺序实现：

1. 初始化 Tauri 2 + React + TypeScript + Ant Design 项目。
2. 实现本地数据目录、SQLite 初始化和 migration。
3. 实现登录页和 `validate_login`。
4. 实现后台 Layout、左侧菜单和路由保护。
5. 实现合同数据模型和合同 CRUD。
6. 实现合同列表、合同表单、合同详情。
7. 实现合同经办人、收款记录、业务员提成子表。
8. 实现增补合同 CRUD 和展开子表格。
9. 实现附件复制、打开、删除。
10. 实现本地备份、恢复、日志和单实例运行。

## 18. 第一版验收重点

第一版验收时重点检查：

- 登录账号密码是否符合需求。
- 登录后是否默认进入合同管理。
- 左侧菜单是否只有合同管理和检测报告管理。
- 检测报告管理是否为空状态占位。
- 合同主表字段是否完整。
- 合同主表操作是否完整。
- 合同子表是否正确展示增补合同。
- 合同表单的经办人、收款记录、业务员提成是否支持多行维护。
- 履约保证金和质保金开关是否正确控制字段和校验。
- 初始合同已收款、未收款金额是否只统计初始合同收款。
- 增补合同表格字段和操作是否完整。
- 增补合同已收款、未收款金额是否计算正确。
- 附件是否复制到本地数据目录，而不是只保存原始路径。
- 删除是否二次确认并软删除。
