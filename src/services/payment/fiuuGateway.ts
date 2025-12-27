import crypto from "crypto";
import { Prisma, PaymentStatus } from "@prisma/client";
import { FiuuConfig } from "../../config/fiuu";

export interface FiuuCheckoutPayload {
  paymentUrl: string;
  params: Record<string, string>;
}

export interface FiuuNotificationPayload extends Record<string, any> {
  orderid?: string;
  order_id?: string;
  status?: string;
  tranID?: string;
  transaction_id?: string;
  amount?: string;
  currency?: string;
  domain?: string;
  appcode?: string;
  skey?: string;
  vcode?: string;
  channel?: string;
  error_code?: string;
  error_desc?: string;
  payment_date?: string;
}

export function formatAmount(
  amount: Prisma.Decimal | number | string,
): string {
  const decimal =
    amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
  return decimal.toFixed(2);
}

export function generateOrderId(prefix = "DL"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function buildCheckoutPayload(args: {
  config: FiuuConfig;
  amount: string;
  orderId: string;
  description: string;
  customer: { name?: string | null; email?: string | null; phone?: string | null };
  returnUrl: string;
  notificationUrl: string;
  callbackUrl: string;
}): FiuuCheckoutPayload {
  const { config, amount, orderId, description, customer } = args;

  const vcode = computeVcode(amount, orderId, config);

  const params: Record<string, string> = {
    amount,
    orderid: orderId,
    domain: config.merchantId,
    currency: "MYR",
    bill_name: customer.name || "Deuce League Player",
    bill_email: customer.email || "support@deuceleague.com",
    bill_mobile: customer.phone || "",
    bill_desc: description,
    country: "MY",
    returnurl: args.returnUrl,
    notify_url: args.notificationUrl,
    callback_url: args.callbackUrl,
    vcode,
  };

  const paymentUrl = `${config.baseUrl.replace(/\/$/, "")}/MOLPay/pay/${config.merchantId}/`;

  return { paymentUrl, params };
}

export function computeVcode(
  amount: string,
  orderId: string,
  config: FiuuConfig,
): string {
  const normalizedAmount = Number.parseFloat(amount).toFixed(2);
  const payload = `${normalizedAmount}${config.merchantId}${orderId}${config.verifyKey}`;
  return crypto.createHash("md5").update(payload).digest("hex");
}

export function verifyNotificationSignature(
  payload: FiuuNotificationPayload,
  config: FiuuConfig,
): boolean {
  const orderId = payload.orderid || payload.order_id;
  const status = payload.status || payload.stat;
  const transactionId = payload.tranID || payload.transaction_id;
  const amount = payload.amount
    ? Number.parseFloat(payload.amount).toFixed(2)
    : "0.00";
  const currency = payload.currency || "MYR";
  const appcode = payload.appcode || "";
  const domain = payload.domain || config.merchantId;
  const announced = (payload.skey || payload.signature || "").toLowerCase();

  const verifyString = `${transactionId}${orderId}${status}${domain}${amount}${currency}${appcode}${config.verifyKey}`;
  const privateString = `${transactionId}${orderId}${status}${domain}${amount}${currency}${appcode}${config.privateKey}`;

  const hashVerify = crypto.createHash("md5").update(verifyString).digest("hex");
  const hashPrivate = crypto
    .createHash("md5")
    .update(privateString)
    .digest("hex");

  // Old RMS spec: skey is md5(md5(verifyString) + private_key)
  const expected = crypto
    .createHash("md5")
    .update(`${hashVerify}${config.privateKey}`)
    .digest("hex");

  return (
    announced === hashVerify.toLowerCase() ||
    announced === hashPrivate.toLowerCase() ||
    announced === expected.toLowerCase()
  );
}

export function resolvePaymentStatus(
  payload: FiuuNotificationPayload,
): PaymentStatus {
  const status = (payload.status || payload.stat || "").toString().trim();

  if (status === "00" || status.toLowerCase() === "success") {
    return PaymentStatus.COMPLETED;
  }

  if (status === "22" || status.toLowerCase() === "pending") {
    return PaymentStatus.PENDING;
  }

  if (status === "11" || status.toLowerCase() === "failed") {
    return PaymentStatus.FAILED;
  }

  if (status === "99" || status.toLowerCase() === "cancelled") {
    return PaymentStatus.CANCELLED;
  }

  return PaymentStatus.FAILED;
}

