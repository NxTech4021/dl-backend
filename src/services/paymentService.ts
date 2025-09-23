import crypto from 'crypto';
import { fiuuConfig, paymentConfig } from '../config/payment';

export interface PaymentRequest {
  amount: number;
  orderId: string;
  billName: string;
  billEmail: string;
  billMobile?: string;
  billDesc: string;
  userId: string;
  leagueId?: string;
  matchId?: string;
}

export interface PaymentResponse {
  paymentUrl: string;
  orderId: string;
  amount: number;
}

class PaymentService {
  private generateVcode(
    amount: string,
    merchantId: string,
    orderId: string,
    verifyKey: string
  ): string {
    const stringToHash = amount + merchantId + orderId + verifyKey;
    return crypto.createHash('md5').update(stringToHash).digest('hex');
  }

  private generateSkey(
    merchantId: string,
    orderId: string,
    amount: string,
    privateKey: string
  ): string {
    // Correct Fiuu skey generation - two-stage MD5 as per documentation
    // For payment request, we use simplified version for hosted integration
    const stringToHash = merchantId + orderId + amount + privateKey;
    return crypto.createHash('md5').update(stringToHash).digest('hex');
  }

  private generateCorrectSkey(
    txnID: string,
    orderID: string,
    status: string,
    merchantID: string,
    amount: string,
    currency: string,
    paydate: string,
    appcode: string,
    privateKey: string
  ): string {
    // Correct Fiuu skey generation for payment response verification
    // First MD5 hash
    const preSkey = crypto.createHash('md5')
      .update(txnID + orderID + status + merchantID + amount + currency)
      .digest('hex');

    // Second MD5 hash
    const skey = crypto.createHash('md5')
      .update(paydate + merchantID + preSkey + appcode + privateKey)
      .digest('hex');

    return skey;
  }

  async createPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    const {
      amount,
      orderId,
      billName,
      billEmail,
      billMobile,
      billDesc,
    } = paymentRequest;

    const amountStr = (amount * 100).toString(); // Convert to cents

    // Generate verification code
    const vcode = this.generateVcode(
      amountStr,
      fiuuConfig.merchantId,
      orderId,
      fiuuConfig.verifyKey
    );

    // Generate signature key
    const skey = this.generateSkey(
      fiuuConfig.merchantId,
      orderId,
      amountStr,
      fiuuConfig.privateKey
    );

    // Prepare payment parameters for Fiuu (using correct parameter names)
    const paymentParams = {
      // Core required parameters
      MerchantID: fiuuConfig.merchantId,
      RefNo: orderId,
      Amount: amountStr,
      Currency: paymentConfig.currency,

      // Billing information
      bill_name: billName,
      bill_email: billEmail,
      bill_mobile: billMobile || '',
      bill_desc: billDesc,

      // Additional parameters
      country: 'MY',

      // Security parameters
      vcode: vcode,

      // Return URLs
      returnurl: paymentConfig.returnUrl,
      callbackurl: paymentConfig.notifyUrl,
    };

    console.log('🔐 Fiuu Payment Parameters:', {
      ...paymentParams,
      vcode: '***HIDDEN***'
    });

    // Fiuu RMS hosted payment URL - Use simple format without payment method
    // The trailing slash is important for POST method compatibility
    const basePaymentUrl = `${fiuuConfig.sandboxUrl}/RMS/pay/${fiuuConfig.merchantId}`;
    const queryString = new URLSearchParams(paymentParams).toString();
    const paymentUrl = `${basePaymentUrl}?${queryString}`;

    console.log('💳 Generated Payment URL:', paymentUrl.substring(0, 100) + '...');

    return {
      paymentUrl,
      orderId,
      amount: amount,
    };
  }

  verifyPaymentNotification(data: any): boolean {
    const {
      MerchantID,
      RefNo,
      Amount,
      Currency,
      tranID,
      status,
      paydate,
      appcode,
      skey,
    } = data;

    // Generate expected skey using Fiuu's two-stage method
    const expectedSkey = this.generateCorrectSkey(
      tranID,
      RefNo,
      status,
      MerchantID,
      Amount,
      Currency,
      paydate,
      appcode,
      fiuuConfig.privateKey
    );

    return expectedSkey.toLowerCase() === skey.toLowerCase();
  }

  verifyPaymentReturn(data: any): boolean {
    const {
      MerchantID,
      RefNo,
      Amount,
      Currency,
      tranID,
      status,
      paydate,
      appcode,
      skey,
    } = data;

    // Generate expected skey for return URL (same method as notification)
    const expectedSkey = this.generateCorrectSkey(
      tranID,
      RefNo,
      status,
      MerchantID,
      Amount,
      Currency,
      paydate,
      appcode,
      fiuuConfig.privateKey
    );

    return expectedSkey.toLowerCase() === skey.toLowerCase();
  }

  parsePaymentStatus(status: string): 'success' | 'failed' | 'pending' {
    switch (status) {
      case '00':
        return 'success';
      case '11':
        return 'failed';
      case '22':
        return 'pending';
      default:
        return 'failed';
    }
  }
}

export default new PaymentService();