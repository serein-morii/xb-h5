export type OrderPaymentStatus = 0 | 1 | 2 | 3;

type OrderData = Record<string, unknown>;

const PAID_VALUES = new Set(["1", "true", "paid", "已付款"]);
const REFUNDED_VALUES = new Set(["2", "refunded", "refund", "已退款"]);
const CONFIRMING_VALUES = new Set(["3", "confirming", "pending_confirm", "待确认"]);
const UNPAID_VALUES = new Set(["0", "false", "unpaid", "未付款"]);

export function normalizeOrderPaymentStatus(value: unknown): OrderPaymentStatus | undefined {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    return value === 0 || value === 1 || value === 2 || value === 3 ? value : undefined;
  }

  const normalized = String(value ?? "").trim().toLocaleLowerCase();
  if (PAID_VALUES.has(normalized)) return 1;
  if (REFUNDED_VALUES.has(normalized)) return 2;
  if (CONFIRMING_VALUES.has(normalized)) return 3;
  if (UNPAID_VALUES.has(normalized)) return 0;
  return undefined;
}

function paymentStatusFrom(order: OrderData | null | undefined) {
  if (!order) return undefined;
  return normalizeOrderPaymentStatus(
    order.payStatus
      ?? order.paymentStatus
      ?? order.paidStatus
      ?? order.isPaid,
  );
}

/**
 * 详情接口的 OrderVO 可能没有付款字段，不能直接替换列表接口返回的 OrderInfo。
 * 详情字段优先；详情未携带或值无法识别时，保留列表中已经确认的付款状态。
 */
export function mergeOrderDetailPaymentStatus(
  listOrder: OrderData,
  detailOrder?: OrderData | null,
) {
  const detailStatus = paymentStatusFrom(detailOrder);
  const listStatus = paymentStatusFrom(listOrder);

  return {
    ...listOrder,
    ...(detailOrder || {}),
    payStatus: detailStatus ?? listStatus ?? 0,
  };
}
