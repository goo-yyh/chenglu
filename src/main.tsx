import React from "react";
import ReactDOM from "react-dom/client";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import RootApp from "./app/App";
import "./styles.css";

dayjs.locale("zh-cn");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        components: {
          Layout: {
            siderBg: "#111827",
            triggerBg: "#111827",
          },
          Menu: {
            darkItemBg: "#111827",
            darkSubMenuItemBg: "#111827",
            darkItemSelectedBg: "#1677ff",
          },
        },
      }}
    >
      <AntdApp>
        <RootApp />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
