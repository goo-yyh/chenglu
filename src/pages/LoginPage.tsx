import { App, Button, Form, Input, Typography } from "antd";
import { LockKeyhole, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/App";
import { validateLogin } from "../services/authApi";
import { getErrorMessage } from "../utils/errors";

interface LoginFormValues {
  account: string;
  password: string;
}

export default function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form] = Form.useForm<LoginFormValues>();

  async function handleFinish(values: LoginFormValues) {
    try {
      const ok = await validateLogin(values.account, values.password);
      if (!ok) {
        message.error("账号或密码错误");
        return;
      }
      login();
      navigate("/contracts", { replace: true });
    } catch (error) {
      message.error(getErrorMessage(error, "登录失败"));
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div>
          <Typography.Title level={2} className="login-title">
            合同管理
          </Typography.Title>
          <Typography.Text type="secondary">合同与收款台账</Typography.Text>
        </div>
        <Form
          form={form}
          layout="vertical"
          size="large"
          requiredMark={false}
          onFinish={handleFinish}
          onFinishFailed={() => message.error("请填写必填项")}
        >
          <Form.Item
            label="账号"
            name="account"
            rules={[{ required: true, message: "请输入账号" }]}
          >
            <Input prefix={<UserRound size={18} />} autoFocus />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password prefix={<LockKeyhole size={18} />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </section>
    </main>
  );
}
