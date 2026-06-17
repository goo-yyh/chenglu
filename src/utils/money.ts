export function formatMoney(value?: number | null) {
  const amount = Number(value || 0);
  const formattedAmount = amount.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formattedAmount} 万`;
}

export function toAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
