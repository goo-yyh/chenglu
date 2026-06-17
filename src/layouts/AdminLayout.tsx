import { useState } from "react";
import { App, Button, Layout, Menu, Popover, Space, Typography } from "antd";
import {
  ClipboardList,
  DatabaseBackup,
  FileText,
  FolderOpen,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/App";
import { createBackup, openDataDir } from "../services/systemApi";
import { getErrorMessage } from "../utils/errors";

const { Sider, Header, Content } = Layout;

export default function AdminLayout() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const selectedKey = location.pathname.startsWith("/inspection-reports")
    ? "inspection-reports"
    : "contracts";

  async function handleBackup() {
    try {
      await createBackup("手动备份");
      message.success("备份已创建");
      setSettingsOpen(false);
    } catch (error) {
      message.error(getErrorMessage(error, "备份创建失败"));
    }
  }

  async function handleOpenDataDir() {
    try {
      await openDataDir();
      setSettingsOpen(false);
    } catch (error) {
      message.error(getErrorMessage(error, "数据目录打开失败"));
    }
  }

  return (
    <Layout className="app-shell">
      <Sider width={220} className="app-sider">
        <div className="brand-block">
          <div className="brand-mark">成</div>
          <div>
            <div className="brand-title">合同管理</div>
            <div className="brand-subtitle">本地合同台账</div>
          </div>
        </div>
        <Menu
          className="sider-menu"
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: "contracts",
              icon: <FileText size={17} />,
              label: "合同管理",
              onClick: () => navigate("/contracts"),
            },
            {
              key: "inspection-reports",
              icon: <ClipboardList size={17} />,
              label: "检测报告管理",
              onClick: () => navigate("/inspection-reports"),
            },
          ]}
        />
        <div className="sider-settings">
          <Popover
            arrow={false}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            placement="rightBottom"
            trigger="click"
            content={
              <Space className="settings-popover" direction="vertical" size={8}>
                <Button block icon={<DatabaseBackup size={16} />} onClick={handleBackup}>
                  创建备份
                </Button>
                <Button block icon={<FolderOpen size={16} />} onClick={handleOpenDataDir}>
                  打开数据目录
                </Button>
              </Space>
            }
          >
            <Button
              className="sider-settings-button"
              type="text"
              icon={<Settings size={17} />}
            >
              设置
            </Button>
          </Popover>
        </div>
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Text strong>
            {selectedKey === "contracts" ? "合同管理" : "检测报告管理"}
          </Typography.Text>
          <Space>
            <span className="account-chip">
              <UserRound size={14} />
              <span>chenglu</span>
            </span>
            <Button
              icon={<LogOut size={16} />}
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
