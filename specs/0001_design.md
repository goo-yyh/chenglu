下面是一份根据前面所有讨论整理出来的**完整设计方案**。这版已经收敛为：

> **Windows + macOS 双平台、本地单机使用、无云端、无后端服务、所有数据库和附件都保存在固定本地数据目录内的 Tauri 桌面后台管理系统。**

---

# 1. 项目定位

## 1.1 应用类型

这是一个**纯本地桌面后台管理应用**，主要用于个人或小范围本机使用。

核心特点：

```text
不需要云端
不需要账号系统
不需要线上同步
不需要定时同步
不需要后端 API
不需要七牛云 / OSS
不需要本地 HTTP Server
```

所有数据都存在用户电脑本地：

```text
SQLite 数据库
附件文件
导出文件
本地备份
日志文件
配置文件
```

---

# 2. 技术架构

## 2.1 总体架构

```text
┌────────────────────────────────────────┐
│ Tauri 桌面应用                          │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Vue / React 前端界面                │ │
│ │ - 表单                              │ │
│ │ - 列表                              │ │
│ │ - 搜索                              │ │
│ │ - 统计                              │ │
│ │ - 数据管理                          │ │
│ └──────────────────┬─────────────────┘ │
│                    │ invoke            │
│ ┌──────────────────▼─────────────────┐ │
│ │ Rust 本地业务层                     │ │
│ │ - 数据校验                          │ │
│ │ - SQLite 读写                       │ │
│ │ - 附件复制                          │ │
│ │ - 本地备份                          │ │
│ │ - 数据恢复                          │ │
│ │ - 日志记录                          │ │
│ └──────────────────┬─────────────────┘ │
│                    │                   │
│ ┌──────────────────▼─────────────────┐ │
│ │ 本地固定数据目录                    │ │
│ │ - database/app.db                   │ │
│ │ - attachments/                      │ │
│ │ - backups/                          │ │
│ │ - logs/                             │ │
│ │ - config.json                       │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

Tauri 支持前端通过 command 调用 Rust 函数，command 可以接收参数、返回结果、返回错误，也可以是异步函数，所以这个项目适合采用“前端界面 + Rust 本地业务层”的结构。([Tauri][1])

---

# 3. 技术选型

| 模块        | 推荐选择                                                 |
| --------- | ---------------------------------------------------- |
| 桌面框架      | Tauri 2                                              |
| 前端框架      | Vue 3 或 React                                        |
| UI 组件     | Element Plus / Naive UI / Ant Design Vue / shadcn/ui |
| 本地业务层     | Rust command                                         |
| 本地数据库     | SQLite                                               |
| Rust 数据库库 | rusqlite 或 sqlx                                      |
| 本地附件      | 文件系统目录                                               |
| 配置文件      | config.json                                          |
| 本地备份      | `.appbackup` 备份包                                     |
| 日志        | tauri-plugin-log                                     |
| 单实例       | tauri-plugin-single-instance                         |

建议数据库和附件相关逻辑都放在 Rust 侧，前端不要直接操作数据库和文件系统。

---

# 4. 跨平台数据目录设计

## 4.1 核心原则

你要支持 Windows 和 macOS，所以不能写死：

```text
C:\xxx
```

也不能写死：

```text
/Users/xxx
```

应该让程序根据当前系统解析出一个固定的本地数据根目录。

Tauri 的 path API 提供 `appLocalDataDir()`，用于返回应用本地数据文件的推荐目录；它会基于系统本地数据目录和应用的 bundle identifier 生成路径。([Tauri][2])

---

## 4.2 推荐数据根目录

建议默认使用系统标准的本地应用数据目录。

```text
Windows:
%LOCALAPPDATA%\MyAdminData\

macOS:
~/Library/Application Support/MyAdminData/
```

实际示例：

```text
Windows:
C:\Users\zhangsan\AppData\Local\MyAdminData\

macOS:
/Users/zhangsan/Library/Application Support/MyAdminData/
```

这两个位置都适合存放应用自己的本地数据。

---

## 4.3 是否可以放 Documents？

可以，但不建议作为默认。

```text
Windows:
C:\Users\zhangsan\Documents\MyAdminData\

macOS:
/Users/zhangsan/Documents/MyAdminData/
```

Documents 的优点是用户容易找到，缺点是可能被 OneDrive、iCloud 或其他同步工具自动同步。你的需求是“所有数据保存在本地电脑”，所以默认放系统本地应用数据目录更合适。

建议产品上提供：

```text
系统设置 → 打开数据目录
```

这样即使目录隐藏，用户也能一键打开。

---

# 5. 固定数据目录结构

不管是 Windows 还是 macOS，目录内部结构保持完全一致。

```text
MyAdminData/
├─ database/
│  ├─ app.db
│  ├─ app.db-wal
│  └─ app.db-shm
│
├─ attachments/
│  ├─ images/
│  │  └─ 2026/
│  │     └─ 06/
│  │        └─ att_xxx.png
│  │
│  ├─ documents/
│  │  └─ 2026/
│  │     └─ 06/
│  │        └─ att_xxx.pdf
│  │
│  ├─ excels/
│  │  └─ 2026/
│  │     └─ 06/
│  │        └─ att_xxx.xlsx
│  │
│  ├─ others/
│  │  └─ 2026/
│  │     └─ 06/
│  │        └─ att_xxx.bin
│  │
│  └─ trash/
│
├─ backups/
│  ├─ manual/
│  ├─ auto/
│  └─ before_restore/
│
├─ exports/
│  ├─ excel/
│  ├─ csv/
│  └─ pdf/
│
├─ logs/
│  ├─ app.log
│  ├─ error.log
│  └─ backup.log
│
├─ temp/
└─ config.json
```

最核心的数据是：

```text
MyAdminData/database/app.db
MyAdminData/attachments/
```

以后换电脑时，理论上只需要复制整个 `MyAdminData` 文件夹即可完成迁移。

---

# 6. 数据库设计

## 6.1 数据库文件

数据库固定放在：

```text
MyAdminData/database/app.db
```

运行时可能出现：

```text
app.db
app.db-wal
app.db-shm
```

如果开启 SQLite WAL 模式，`.db-wal` 和 `.db-shm` 文件是正常现象；SQLite 官方文档也说明，WAL 模式设置后会持久保存在数据库文件状态中。([SQLite][3])

---

## 6.2 SQLite 初始化参数

建议应用初始化数据库时执行：

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

说明：

```text
journal_mode = WAL       提升桌面应用读写体验
foreign_keys = ON        启用外键约束
busy_timeout = 5000      避免短暂锁表时报错太快
synchronous = NORMAL     在性能和安全之间折中
```

---

## 6.3 不需要同步字段

因为现在是纯本地方案，所以不要设计这些字段：

```text
server_id
server_version
sync_status
sync_outbox
sync_state
last_sync_at
change_log
```

这些都是云同步系统才需要的。

---

## 6.4 基础业务字段

每张核心业务表建议统一包含：

```sql
id TEXT PRIMARY KEY,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL,
deleted_at TEXT
```

其中：

```text
id          使用 UUID / ULID
created_at 创建时间
updated_at 更新时间
deleted_at 软删除时间
```

建议使用软删除，避免误删后无法恢复。

---

## 6.5 示例业务表

### 客户表

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

### 商品表

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  price REAL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

### 订单表

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  total_amount REAL DEFAULT 0,
  status TEXT NOT NULL,
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

### 订单明细表

```sql
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
```

---

# 7. 附件设计

## 7.1 附件处理原则

用户在软件中“上传附件”时，本质不是上传到云端，而是：

> 用户选择一个本地文件，应用把该文件复制到 `MyAdminData/attachments/` 目录中，然后数据库记录这个附件。

不要只保存用户原始文件路径。

错误做法：

```text
数据库保存：
C:\Users\zhangsan\Desktop\合同.pdf
```

如果用户删除桌面文件，软件里的附件就失效了。

正确做法：

```text
用户选择：
C:\Users\zhangsan\Desktop\合同.pdf

应用复制到：
MyAdminData/attachments/documents/2026/06/att_01JYxxx.pdf

数据库保存：
attachments/documents/2026/06/att_01JYxxx.pdf
```

---

## 7.2 数据库只保存相对路径

数据库中永远不要保存绝对路径。

推荐保存：

```text
attachments/documents/2026/06/att_01JYxxx.pdf
```

不要保存：

```text
C:\Users\zhangsan\AppData\Local\MyAdminData\attachments\documents\2026\06\att_01JYxxx.pdf
```

这样 Windows 和 macOS 之间迁移数据时更稳定。

---

## 7.3 附件表

```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  biz_type TEXT NOT NULL,
  biz_id TEXT NOT NULL,

  original_file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  relative_path TEXT NOT NULL,

  mime_type TEXT,
  file_size INTEGER,
  sha256 TEXT,

  created_at TEXT NOT NULL,
  deleted_at TEXT
);
```

示例：

```text
id: att_01JYABC
biz_type: order
biz_id: order_001
original_file_name: 合同.pdf
stored_file_name: att_01JYABC.pdf
relative_path: attachments/documents/2026/06/att_01JYABC.pdf
mime_type: application/pdf
file_size: 839201
sha256: xxxxxx
```

---

## 7.4 附件命名规则

不要使用原始文件名作为存储文件名。

推荐：

```text
att_{uuid}.{ext}
```

例如：

```text
att_01JYABCD9X8P3Q2K.pdf
att_01JYABCD9X8P3Q2K.png
att_01JYABCD9X8P3Q2K.xlsx
```

原始文件名只保存在数据库字段：

```text
original_file_name
```

这样可以避免：

```text
同名覆盖
特殊字符问题
中文路径兼容问题
文件名过长问题
跨平台路径问题
```

---

## 7.5 附件保存规则

按照文件类型和年月分目录：

```text
图片：
attachments/images/2026/06/att_xxx.png

文档：
attachments/documents/2026/06/att_xxx.pdf

Excel：
attachments/excels/2026/06/att_xxx.xlsx

其他：
attachments/others/2026/06/att_xxx.bin
```

---

## 7.6 附件上传流程

```text
用户点击“添加附件”
        ↓
选择本地文件
        ↓
前端把文件路径传给 Rust command
        ↓
Rust 检查文件是否存在
        ↓
Rust 识别扩展名和文件类型
        ↓
Rust 生成新文件名
        ↓
Rust 复制文件到 attachments 目录
        ↓
Rust 计算 sha256
        ↓
Rust 写入 attachments 表
        ↓
前端刷新附件列表
```

---

## 7.7 附件打开流程

```text
用户点击附件
        ↓
前端传 attachment_id
        ↓
Rust 查询 attachments 表
        ↓
Rust 拼接 DataRoot + relative_path
        ↓
确认文件存在
        ↓
调用系统默认程序打开
```

---

## 7.8 附件删除流程

建议不要立即物理删除，先移动到回收目录。

```text
attachments/trash/
```

流程：

```text
用户删除附件
        ↓
数据库 deleted_at 标记删除
        ↓
文件移动到 attachments/trash/
```

这样误删后还有机会找回。

---

# 8. 本地备份设计

即使不做云端，也必须做本地备份。真正的风险通常不是网络攻击，而是：

```text
误删
数据库损坏
软件升级失败
电脑硬盘故障
恢复错文件
附件被误移动
```

---

## 8.1 备份包格式

使用自定义后缀：

```text
backup_2026-06-16_203000.appbackup
```

本质可以是一个 zip 包，里面包含：

```text
backup_2026-06-16_203000.appbackup
├─ metadata.json
├─ database.sqlite
├─ attachments/
├─ config.json
└─ checksum.sha256
```

---

## 8.2 metadata.json

```json
{
  "app_name": "MyAdmin",
  "app_version": "1.0.0",
  "backup_version": 1,
  "database_version": 4,
  "created_at": "2026-06-16T20:30:00+08:00",
  "description": "手动备份",
  "contains_attachments": true,
  "database_file": "database.sqlite"
}
```

---

## 8.3 备份目录

```text
MyAdminData/backups/
├─ manual/
│  └─ backup_2026-06-16_203000.appbackup
│
├─ auto/
│  └─ auto_2026-06-16.appbackup
│
└─ before_restore/
   └─ before_restore_2026-06-16_210000.appbackup
```

---

## 8.4 不要直接复制运行中的 app.db

如果 SQLite 使用 WAL 模式，直接复制 `app.db` 可能不是一个安全的一致性备份。

推荐使用：

```text
SQLite Online Backup API
或者
VACUUM INTO
```

SQLite 官方文档说明，Online Backup API 是备份 live SQLite database 的方法，`VACUUM INTO` 也可以把 live database 复制成一个单独的数据库文件。([SQLite][4])

---

## 8.5 手动备份流程

```text
用户点击“创建备份”
        ↓
Rust 使用 SQLite Backup API / VACUUM INTO 生成 database.sqlite 快照
        ↓
复制 attachments 目录
        ↓
复制 config.json
        ↓
生成 metadata.json
        ↓
计算 checksum.sha256
        ↓
打包成 .appbackup
        ↓
保存到 backups/manual/
        ↓
写入 backup_records
        ↓
提示备份成功
```

---

## 8.6 自动备份策略

建议加入简单自动备份：

```text
每天第一次启动时自动备份一次
每次版本升级前自动备份一次
每次恢复前自动备份一次
```

保留规则建议：

```text
最近 7 天：每天保留 1 份
最近 4 周：每周保留 1 份
最近 6 个月：每月保留 1 份
```

---

# 9. 数据恢复设计

恢复流程一定要谨慎，因为它会覆盖当前本地数据。

## 9.1 恢复流程

```text
用户选择 .appbackup 文件
        ↓
Rust 解压到 temp/
        ↓
读取 metadata.json
        ↓
校验 app_name / backup_version / database_version
        ↓
校验 checksum
        ↓
提示用户：恢复会覆盖当前数据
        ↓
自动创建 before_restore 备份
        ↓
关闭 SQLite 连接
        ↓
替换 database/app.db
        ↓
替换 attachments/
        ↓
重新打开数据库
        ↓
执行数据库 migration
        ↓
提示恢复完成，必要时重启应用
```

---

## 9.2 恢复前备份

恢复前必须自动创建：

```text
MyAdminData/backups/before_restore/before_restore_2026-06-16_210000.appbackup
```

这样即使用户恢复错版本，也可以回滚。

---

# 10. 数据库迁移设计

以后版本升级时一定会改表结构，所以必须有 migration 机制。

## 10.1 migration 表

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```

---

## 10.2 migration 文件结构

```text
src-tauri/migrations/
├─ 001_init.sql
├─ 002_add_products.sql
├─ 003_add_orders.sql
├─ 004_add_attachments.sql
└─ 005_add_backup_records.sql
```

---

## 10.3 启动时迁移流程

```text
应用启动
        ↓
解析 DataRoot
        ↓
创建目录
        ↓
打开 database/app.db
        ↓
读取 schema_migrations
        ↓
执行未执行过的 migration
        ↓
写入 schema_migrations
        ↓
进入主界面
```

---

# 11. 本地配置文件设计

配置文件放在：

```text
MyAdminData/config.json
```

示例：

```json
{
  "app_name": "MyAdmin",
  "data_root_mode": "local_app_data",
  "database": {
    "path": "database/app.db",
    "journal_mode": "WAL",
    "busy_timeout": 5000
  },
  "attachments": {
    "root": "attachments",
    "store_by_date": true,
    "keep_original_name": false
  },
  "backup": {
    "auto_backup_enabled": true,
    "auto_backup_on_start": true,
    "auto_backup_before_restore": true,
    "keep_daily": 7,
    "keep_weekly": 4,
    "keep_monthly": 6
  },
  "ui": {
    "theme": "light",
    "page_size": 20
  }
}
```

---

# 12. 备份记录表

建议本地数据库记录每次备份。

```sql
CREATE TABLE backup_records (
  id TEXT PRIMARY KEY,
  backup_type TEXT NOT NULL,       -- manual / auto / before_restore
  file_name TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  file_size INTEGER,
  sha256 TEXT,
  app_version TEXT,
  database_version INTEGER,
  status TEXT NOT NULL,            -- created / failed / restored
  description TEXT,
  created_at TEXT NOT NULL,
  restored_at TEXT
);
```

---

# 13. Rust 代码结构建议

```text
src-tauri/
├─ src/
│  ├─ main.rs
│  │
│  ├─ commands/
│  │  ├─ customer_commands.rs
│  │  ├─ product_commands.rs
│  │  ├─ order_commands.rs
│  │  ├─ attachment_commands.rs
│  │  ├─ backup_commands.rs
│  │  ├─ restore_commands.rs
│  │  ├─ export_commands.rs
│  │  └─ system_commands.rs
│  │
│  ├─ db/
│  │  ├─ mod.rs
│  │  ├─ connection.rs
│  │  ├─ migrations.rs
│  │  └─ transaction.rs
│  │
│  ├─ services/
│  │  ├─ customer_service.rs
│  │  ├─ product_service.rs
│  │  ├─ order_service.rs
│  │  ├─ attachment_service.rs
│  │  ├─ backup_service.rs
│  │  ├─ restore_service.rs
│  │  └─ export_service.rs
│  │
│  ├─ models/
│  │  ├─ customer.rs
│  │  ├─ product.rs
│  │  ├─ order.rs
│  │  ├─ attachment.rs
│  │  └─ backup.rs
│  │
│  ├─ utils/
│  │  ├─ paths.rs
│  │  ├─ checksum.rs
│  │  ├─ zip.rs
│  │  ├─ file_type.rs
│  │  └─ time.rs
│  │
│  └─ config/
│     └─ app_config.rs
│
├─ migrations/
│  ├─ 001_init.sql
│  ├─ 002_add_products.sql
│  ├─ 003_add_orders.sql
│  ├─ 004_add_attachments.sql
│  └─ 005_add_backup_records.sql
│
└─ tauri.conf.json
```

---

# 14. Rust command 设计

前端只调用 Rust command，不直接读写文件和数据库。

```rust
#[tauri::command]
async fn create_customer(input: CreateCustomerInput) -> Result<Customer, String>;

#[tauri::command]
async fn list_customers(query: CustomerQuery) -> Result<Vec<Customer>, String>;

#[tauri::command]
async fn update_customer(id: String, input: UpdateCustomerInput) -> Result<Customer, String>;

#[tauri::command]
async fn delete_customer(id: String) -> Result<(), String>;

#[tauri::command]
async fn add_attachment(biz_type: String, biz_id: String, source_path: String) -> Result<Attachment, String>;

#[tauri::command]
async fn list_attachments(biz_type: String, biz_id: String) -> Result<Vec<Attachment>, String>;

#[tauri::command]
async fn open_attachment(attachment_id: String) -> Result<(), String>;

#[tauri::command]
async fn delete_attachment(attachment_id: String) -> Result<(), String>;

#[tauri::command]
async fn create_backup(description: Option<String>) -> Result<BackupInfo, String>;

#[tauri::command]
async fn list_local_backups() -> Result<Vec<BackupInfo>, String>;

#[tauri::command]
async fn restore_backup(backup_path: String) -> Result<(), String>;

#[tauri::command]
async fn open_data_dir() -> Result<(), String>;

#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String>;
```

---

# 15. 跨平台路径处理

## 15.1 不手动拼字符串

不要这样写：

```rust
let path = root + "\\attachments\\xxx.pdf";
```

应该这样写：

```rust
let path = root
    .join("attachments")
    .join("documents")
    .join("2026")
    .join("06")
    .join("att_xxx.pdf");
```

原因是 Windows 和 macOS 的路径分隔符不同。

---

## 15.2 统一路径模块

建议写：

```text
src-tauri/src/utils/paths.rs
```

示例：

```rust
use std::path::PathBuf;
use std::fs;

pub struct AppPaths {
    pub root: PathBuf,
    pub database_dir: PathBuf,
    pub database_file: PathBuf,
    pub attachments_dir: PathBuf,
    pub backups_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub config_file: PathBuf,
}

impl AppPaths {
    pub fn new(root: PathBuf) -> Self {
        Self {
            database_dir: root.join("database"),
            database_file: root.join("database").join("app.db"),
            attachments_dir: root.join("attachments"),
            backups_dir: root.join("backups"),
            logs_dir: root.join("logs"),
            temp_dir: root.join("temp"),
            config_file: root.join("config.json"),
            root,
        }
    }

    pub fn ensure_all_dirs(&self) -> std::io::Result<()> {
        fs::create_dir_all(&self.root)?;
        fs::create_dir_all(&self.database_dir)?;

        fs::create_dir_all(self.attachments_dir.join("images"))?;
        fs::create_dir_all(self.attachments_dir.join("documents"))?;
        fs::create_dir_all(self.attachments_dir.join("excels"))?;
        fs::create_dir_all(self.attachments_dir.join("others"))?;
        fs::create_dir_all(self.attachments_dir.join("trash"))?;

        fs::create_dir_all(self.backups_dir.join("manual"))?;
        fs::create_dir_all(self.backups_dir.join("auto"))?;
        fs::create_dir_all(self.backups_dir.join("before_restore"))?;

        fs::create_dir_all(&self.logs_dir)?;
        fs::create_dir_all(&self.temp_dir)?;

        Ok(())
    }
}
```

---

# 16. 前端页面设计

## 16.1 推荐菜单结构

```text
首页
├─ 数据概览
├─ 今日统计
└─ 最近操作

基础资料
├─ 客户管理
├─ 商品管理
├─ 供应商管理
└─ 分类管理

业务管理
├─ 订单管理
├─ 库存管理
└─ 收支记录

报表中心
├─ 销售报表
├─ 库存报表
└─ 客户报表

数据管理
├─ 本地备份
├─ 数据恢复
├─ 数据导出
└─ 数据导入

系统设置
├─ 基础设置
├─ 数据存储位置
├─ 日志查看
└─ 关于软件
```

---

## 16.2 数据管理页面

```text
数据管理
├─ 当前数据
│  ├─ 数据库大小
│  ├─ 附件大小
│  ├─ 数据记录数
│  ├─ 数据库版本
│  └─ 当前数据目录
│
├─ 本地备份
│  ├─ 立即创建备份
│  ├─ 打开备份目录
│  ├─ 导出备份到指定位置
│  └─ 本地备份列表
│
├─ 数据恢复
│  ├─ 从本地备份恢复
│  ├─ 选择外部备份文件恢复
│  └─ 恢复前自动备份开关
│
└─ 数据导出
   ├─ 导出客户 Excel
   ├─ 导出商品 Excel
   ├─ 导出订单 Excel
   └─ 导出报表 PDF
```

---

## 16.3 系统设置页面

```text
系统设置
├─ 数据存储位置
│  ├─ 当前数据目录
│  ├─ 打开数据目录
│  ├─ 打开数据库目录
│  ├─ 打开附件目录
│  └─ 打开备份目录
│
├─ 备份设置
│  ├─ 启用自动备份
│  ├─ 启动时自动备份
│  ├─ 恢复前自动备份
│  └─ 备份保留规则
│
├─ 日志设置
│  ├─ 打开日志目录
│  └─ 清理旧日志
│
└─ 关于软件
```

---

# 17. 日志设计

建议记录：

```text
应用启动
数据目录初始化
数据库连接
migration 执行
业务增删改
附件添加 / 删除 / 打开失败
创建备份
恢复备份
导入导出
异常错误
```

Tauri 官方 logging 插件支持配置日志输出目标，并且默认可以输出到 stdout 和应用日志目录文件。([Tauri][5])

日志目录：

```text
MyAdminData/logs/
├─ app.log
├─ error.log
└─ backup.log
```

---

# 18. 单实例运行

建议强制应用单实例运行。

原因：

```text
避免两个程序同时写同一个 SQLite
避免备份时另一个实例还在写数据
避免恢复时另一个实例还在读数据库
```

Tauri 的 single-instance 插件用于确保只运行一个应用实例，并且官方文档提示该插件应该尽早注册。([Tauri][6])

---

# 19. 数据导入导出

要区分两个概念：

## 19.1 备份恢复

用于完整恢复系统。

```text
.appbackup
包含 database.sqlite + attachments + config.json + metadata
```

## 19.2 数据导出

用于给人看，或者和其他系统交换。

```text
Excel
CSV
JSON
PDF
```

不要用 Excel 作为主备份格式。Excel 适合导出报表，不适合完整恢复整个系统。

---

# 20. 安全与加密

第一版可以不做复杂加密。

建议优先级：

```text
第一版：不做加密，先保证本地数据、附件、备份稳定
第二版：增加打开软件密码
第三版：增加备份包密码
第四版：考虑 SQLCipher 数据库加密
```

如果只是自己使用，第一版不加密也可以接受。但如果数据包含客户手机号、合同、价格、财务等信息，后续建议至少支持备份包加密。

---

# 21. 启动流程

应用启动时执行：

```text
1. 判断当前系统：Windows / macOS
2. 获取系统本地应用数据目录
3. 拼接 MyAdminData
4. 创建 database、attachments、backups、logs、temp 等目录
5. 读取或创建 config.json
6. 打开 database/app.db
7. 设置 SQLite PRAGMA
8. 执行数据库 migration
9. 检查是否需要自动备份
10. 进入主界面
```

---

# 22. 附件新增完整流程

```text
1. 用户在订单页面点击“添加附件”
2. 前端打开文件选择器
3. 用户选择文件
4. 前端调用 add_attachment command
5. Rust 校验文件是否存在
6. Rust 获取扩展名
7. Rust 判断分类 images / documents / excels / others
8. Rust 生成 stored_file_name
9. Rust 创建年月目录
10. Rust 复制文件到 attachments
11. Rust 计算 sha256
12. Rust 写入 attachments 表
13. Rust 返回附件信息
14. 前端刷新附件列表
```

---

# 23. 创建备份完整流程

```text
1. 用户点击“立即备份”
2. Rust 创建临时目录
3. Rust 使用 SQLite Backup API / VACUUM INTO 生成 database.sqlite
4. Rust 复制 attachments 目录
5. Rust 复制 config.json
6. Rust 生成 metadata.json
7. Rust 计算 checksum.sha256
8. Rust 打包成 .appbackup
9. Rust 保存到 backups/manual
10. Rust 写入 backup_records
11. 前端提示备份成功
```

---

# 24. 恢复备份完整流程

```text
1. 用户选择 .appbackup 文件
2. Rust 解压到 temp
3. Rust 读取 metadata.json
4. Rust 校验应用名、备份版本、数据库版本
5. Rust 校验 checksum
6. 前端弹窗二次确认
7. Rust 自动创建 before_restore 备份
8. Rust 关闭数据库连接
9. Rust 替换 database/app.db
10. Rust 替换 attachments
11. Rust 重新打开数据库
12. Rust 执行 migration
13. 前端提示恢复完成
14. 必要时重启应用
```

---

# 25. 不做的内容

这一版明确不做：

```text
不做云端存储
不做七牛云
不做 OSS
不做线上后端
不做用户登录
不做上传凭证
不做实时同步
不做定时同步
不做多端冲突处理
不做 WebSocket
不做本地 HTTP Server
不做 sync_outbox
不做 server_version
```

系统越简单，越稳定。

---

# 26. 推荐开发路线

## 第一阶段：基础框架

```text
1. 创建 Tauri 2 项目
2. 选择 Vue 3 或 React
3. 搭建基础布局
4. 实现 Rust command 调用
5. 初始化跨平台数据目录
6. 初始化 SQLite
```

---

## 第二阶段：核心业务

```text
1. 设计业务表
2. 实现 migrations
3. 实现客户 CRUD
4. 实现商品 CRUD
5. 实现订单 CRUD
6. 实现搜索、分页、筛选
```

---

## 第三阶段：附件系统

```text
1. 设计 attachments 表
2. 实现附件复制到固定目录
3. 实现附件列表
4. 实现附件打开
5. 实现附件删除到 trash
6. 实现附件缺失提示
```

---

## 第四阶段：备份恢复

```text
1. 实现 SQLite 一致性快照
2. 实现 attachments 打包
3. 实现 .appbackup 生成
4. 实现本地备份列表
5. 实现恢复前自动备份
6. 实现 .appbackup 恢复
```

---

## 第五阶段：稳定性增强

```text
1. 单实例运行
2. 日志系统
3. 自动备份
4. 备份清理规则
5. 数据目录打开按钮
6. 错误提示优化
```

---

## 第六阶段：导入导出

```text
1. Excel 导出
2. CSV 导出
3. PDF 报表
4. Excel 导入
5. 导入前预览
6. 导入失败回滚
```

---

# 27. 最终方案一句话总结

最终建议采用：

```text
Tauri 2
+ Vue 3 / React
+ Rust command 本地业务层
+ SQLite 本地数据库
+ 固定本地数据目录
+ 本地附件目录
+ 本地备份恢复
+ 单实例运行
+ 日志记录
+ Windows + macOS 双平台支持
```

数据目录规则：

```text
Windows:
%LOCALAPPDATA%\MyAdminData\

macOS:
~/Library/Application Support/MyAdminData/
```

核心文件：

```text
MyAdminData/database/app.db
MyAdminData/attachments/
MyAdminData/backups/
MyAdminData/logs/
MyAdminData/config.json
```

核心原则：

> **数据库只保存业务数据和附件相对路径；附件真实文件统一复制到固定数据目录；备份时打包数据库快照和附件目录；恢复前必须自动生成回滚备份。**

[1]: https://v2.tauri.app/develop/calling-rust/?utm_source=chatgpt.com "Calling Rust from the Frontend"
[2]: https://v2.tauri.app/reference/javascript/api/namespacepath/?utm_source=chatgpt.com "path"
[3]: https://sqlite.org/wal.html?utm_source=chatgpt.com "Write-Ahead Logging"
[4]: https://sqlite.org/backup.html?utm_source=chatgpt.com "SQLite Backup API"
[5]: https://v2.tauri.app/plugin/logging/?utm_source=chatgpt.com "Logging"
[6]: https://v2.tauri.app/plugin/single-instance/?utm_source=chatgpt.com "Single Instance"
