/**
 * Sends the sales team an enquiry notification (ARCHITECTURE §3.3, ENQ-03).
 * SMTP is the PoC adapter; any provider can implement this.
 * Implementations throw EmailDeliveryFailedError when the message is not
 * accepted for sending (A31).
 */
export interface Notifier {
  sendEnquiry(enquiry: EnquiryNotification): Promise<void>;
}

/** Everything the sales email needs (ENQ-03.FR1). Product details come from the catalogue, never the request (A28). */
export interface EnquiryNotification {
  customer: {
    name: string;
    email: string;
    phone: string | undefined;
    message: string | undefined;
  };
  product: {
    id: string;
    title: string;
    price: number;
    /** Public link to the product page. */
    url: string;
  };
  submittedAt: Date;
}
