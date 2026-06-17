import { Typography } from "antd";
import { formatMoney } from "../utils/money";

export default function MoneyText({ value }: { value?: number | null }) {
  const negative = Number(value || 0) < 0;
  return (
    <Typography.Text type={negative ? "danger" : undefined}>
      {formatMoney(value)}
    </Typography.Text>
  );
}
