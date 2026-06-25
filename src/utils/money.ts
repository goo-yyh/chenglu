export function formatMoney(value?: number | null) {
  const amount = Number(value || 0);
  const formattedAmount = amount.toLocaleString("zh-CN", {
    maximumFractionDigits: 0,
  });
  return `${formattedAmount} 元`;
}

export function toAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
