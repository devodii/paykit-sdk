/**
 * Raw MoneyGram API types.
 *
 * MoneyGram's Transfer API is a 3-step flow, unlike a single "create
 * payment" call:
 *   1. POST /transfer/v1/transactions/quote        -> get a transactionId + fees/fx
 *   2. PUT  /transfer/v1/transactions/{id}          -> attach sender/receiver/compliance data
 *   3. PUT  /transfer/v1/transactions/{id}/commit   -> actually move the money
 *
 * @see https://developer.moneygram.com/moneygram-developer/docs/transfer-api
 * @see https://developer.moneygram.com/moneygram-developer/docs/quote
 * @see https://developer.moneygram.com/moneygram-developer/docs/update-a-transaction
 * @see https://developer.moneygram.com/moneygram-developer/docs/commit-a-transaction
 */

export interface MoneyGramTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  issued_at?: string;
  status?: string;
}

export interface MoneyGramMoney {
  value: number;
  currencyCode: string;
}

export interface MoneyGramAdditionalCharge {
  typeCode: string;
  label: string;
  value: number;
  currencyCode: string;
}

export interface MoneyGramDiscountsApplied {
  totalDiscount: string;
  promotionDetails: string;
}

export interface MoneyGramSendAmount {
  value?: number;
  currencyCode?: string;
  amount?: MoneyGramMoney;
  fees?: MoneyGramMoney;
  taxes?: MoneyGramMoney;
  additionalCharges?: MoneyGramAdditionalCharge[];
  discountsApplied?: MoneyGramDiscountsApplied;
  total?: MoneyGramMoney;
}

export interface MoneyGramReceiveAmount {
  value?: number;
  currencyCode?: string;
  amount?: MoneyGramMoney;
  fees?: MoneyGramMoney;
  taxes?: MoneyGramMoney;
  additionalCharges?: MoneyGramAdditionalCharge[];
  total?: MoneyGramMoney;
  fxRate?: number;
  fxRateEstimated?: boolean;
}

export interface MoneyGramName {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
}

export interface MoneyGramAddress {
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  countrySubdivisionCode?: string;
  countryCode: string;
  postalCode?: string;
}

export interface MoneyGramMobilePhone {
  number: string;
  countryDialCode: string;
}

export interface MoneyGramPersonalDetails {
  genderCode?: string;
  dateOfBirth: string; // YYYY-MM-DD
  birthCity?: string;
  birthCountryCode?: string;
  citizenshipCountryCode?: string;
  occupationCode?: string;
  politicalExposedPerson?: boolean;
  nationalityCountryCode?: string;
}

export interface MoneyGramIdentification {
  typeCode: string;
  id: string;
  issueCountrySubdivisionCode?: string;
  issueCountryCode: string;
  expirationYear?: string;
  expirationMonth?: string;
  expirationDay?: string;
  issueAuthority?: string;
  issueCity?: string;
  issueYear?: string;
  issueMonth?: string;
  issueDay?: string;
}

export interface MoneyGramSender {
  name: MoneyGramName;
  address: MoneyGramAddress;
  mobilePhone: MoneyGramMobilePhone;
  email?: string;
  enrolInRewards?: boolean;
  personalDetails: MoneyGramPersonalDetails;
  primaryIdentification: MoneyGramIdentification;
  secondaryIdentification?: MoneyGramIdentification;
  profileId?: string;
  additionalDetails?: Record<string, string>;
}

export interface MoneyGramReceiver {
  name: MoneyGramName;
  address?: MoneyGramAddress;
  mobilePhone?: MoneyGramMobilePhone;
}

export interface MoneyGramFundingSource {
  tenderType?: string;
  provider?: string;
  providerNetworkCode?: string;
  providerAccountNumber?: string;
  accountIdentifier?: string;
}

export interface MoneyGramTransactionInformation {
  purposeOfTransactionCode?: string;
  sourceOfFundsCode?: string;
  proofOfFundsCode?: string;
  intendedUseOfMGIServicesCode?: string;
  relationshipToReceiver?: string;
}

/** @see https://developer.moneygram.com/moneygram-developer/docs/quote */
export interface MoneyGramQuoteRequest {
  targetAudience: string;
  agentPartnerId: string;
  operatorId: string;
  destinationCountryCode: string;
  destinationCountrySubdivisionCode?: string;
  posId?: string;
  userLanguage?: string;
  serviceOptionCode?: string;
  serviceOptionRoutingCode?: string;
  sendAmount?: { value: number; currencyCode: string };
  receiveAmount?: { value: number; currencyCode: string };
  receiveCurrencyCode?: string;
  sendCurrencyCode?: string;
  sendAmountIncludingFee?: boolean;
  receiverSameAsSender?: boolean;
  promotionCode?: string;
  rewardsNumber?: string;
  fundInStore?: boolean;
  fundinstoreAgentPartnerId?: string;
  fundingSource?: MoneyGramFundingSource;
  additionalDetails?: Record<string, string>;
}

export interface MoneyGramQuoteTransaction {
  transactionId: string;
  serviceOptionCode: string;
  serviceOptionName: string;
  serviceOptionRoutingCode?: string;
  serviceOptionRoutingName?: string;
  estimatedDelivery: string;
  sendAmount: MoneyGramSendAmount;
  receiveAmount: MoneyGramReceiveAmount;
}

export interface MoneyGramQuoteResponse {
  transactions: MoneyGramQuoteTransaction[];
}

/** @see https://developer.moneygram.com/moneygram-developer/docs/update-a-transaction */
export interface MoneyGramUpdateTransactionRequest {
  targetAudience: string;
  agentPartnerId: string;
  posId?: string;
  operatorId: string;
  userLanguage?: string;
  destinationCountryCode: string;
  destinationCountrySubdivisionCode?: string;
  serviceOptionCode: string;
  serviceOptionRoutingCode?: string;
  promotionCodes?: string[];
  rewardsNumber?: string;
  placeOnPartnerHold?: boolean;
  fundInStore?: {
    fundInStore: boolean;
    fundInStoreAgentPartnerId?: string;
  };
  sendAmount?: { value: number; currencyCode: string };
  receiveCurrencyCode?: string;
  receiveAmount?: { value: number; currencyCode: string };
  sendCurrencyCode?: string;
  fundingSource?: MoneyGramFundingSource;
  targetAccountProfileId?: string;
  targetaccount?: Record<string, string>;
  sender: MoneyGramSender;
  receiver: MoneyGramReceiver;
  receiverSameAsSender?: boolean;
  transactionInformation?: MoneyGramTransactionInformation;
  receipt?: {
    primaryLanguage?: string;
    secondaryLanguage?: string;
    image?: string;
  };
  partnerTransactionId?: string;
  additionalDetails?: Record<string, string>;
}

export interface MoneyGramUpdateTransactionResponse {
  readyForCommit?: boolean;
  rewardsNumber?: string;
  transactionId?: string;
  serviceOptionCode?: string;
  serviceOptionName: string;
  serviceOptionRoutingCode?: string;
  serviceOptionRoutingName?: string;
  sendAmount: MoneyGramSendAmount;
  receiveAmount: MoneyGramReceiveAmount;
  targetAccountProfileId?: string;
  preCommitReceipt?: { consumerHyperLink?: string };
  additionalDetails?: Record<string, string>;
}

/** @see https://developer.moneygram.com/moneygram-developer/docs/commit-a-transaction */
export interface MoneyGramCommitTransactionRequest {
  fundingSource?: MoneyGramFundingSource;
  partnerSettlementId?: string;
  additionalDetails?: Record<string, string>;
}

export interface MoneyGramCommitTransactionResponse {
  referenceNumber: string;
  fundsInStoreConfirmationCode?: string;
  expectedPayoutDate: string;
  settlement?: {
    reconcileSendAmount?: string;
    reconcileReceiveAmount?: string;
  };
  commitReceipt?: {
    agentHyperLink?: string;
    consumerHyperLink?: string;
  };
}

/** @see https://developer.moneygram.com/moneygram-developer/docs/retrieve-a-transaction-status */
export interface MoneyGramTransactionSubStatus {
  subStatus?: string;
  message?: string;
  targetCustomer?: string;
  dataToCollect?: Array<{ code: string; dataCollection: string }>;
}

export type MoneyGramTransactionStatus =
  | 'UNFUNDED'
  | 'SENT'
  | 'AVAILABLE'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'DELIVERED'
  | 'PROCESSING'
  | 'REJECTED'
  | 'REFUNDED'
  | 'CLOSED';

export interface MoneyGramTransactionStatusResponse {
  transactionId: string;
  referenceNumber: string;
  transactionSendDateTime: string;
  expectedPayoutDate: string;
  transactionStatus: MoneyGramTransactionStatus;
  transactionSubStatus?: MoneyGramTransactionSubStatus[];
  originatingCountryCode: string;
  destinationCountryCode: string;
  serviceOptionCode: string;
  serviceOptionName: string;
  serviceOptionRoutingCode?: string;
  serviceOptionRoutingName?: string;
  sendAmount: MoneyGramSendAmount;
  receiveAmount: MoneyGramReceiveAmount;
  sender: {
    name: MoneyGramName;
    profileId?: string;
    additionalDetails?: Record<string, string>;
  };
  receiver: { name: MoneyGramName };
  additionalDetails?: Record<string, string>;
}

/** @see https://developer.moneygram.com/moneygram-developer/docs/retrieve-a-transaction-refund */
export interface MoneyGramRefundRetrieveResponse {
  transactionId: string;
  refundId: string;
  referenceNumber?: string;
  transactionStatus: MoneyGramTransactionStatus;
  transactionSubStatus?: MoneyGramTransactionSubStatus[];
  availableForRefund: boolean;
  originatingCountryCode?: string;
  destinationCountryCode?: string;
  serviceOptionCode?: string;
  serviceOptionName?: string;
  sendAmount?: MoneyGramSendAmount;
  refundAmount?: MoneyGramSendAmount;
  sender?: { name: MoneyGramName };
  receiver?: { name: MoneyGramName };
}

/** @see https://developer.moneygram.com/moneygram-developer/docs/refund-a-transaction */
export interface MoneyGramRefundCommitRequest {
  targetAudience: string;
  agentPartnerId?: string;
  posId?: string;
  userLanguage?: string;
  refundId: string;
  refundTargetAccount?: {
    tenderType?: string;
    provider?: string;
    providerNetworkCode?: string;
    providerAccountNumber?: string;
    accountIdentifier?: string;
  };
  additionalDetails?: Record<string, string>;
}

export interface MoneyGramRefundCommitResponse {
  referenceNumber: string;
  expectedPayoutDate: string;
  settlement?: {
    reconcileSendAmount?: MoneyGramMoney;
    reconcileReceiveAmount?: MoneyGramMoney;
    walletAddress?: string;
    walletMemo?: string;
  };
  commitReceipt?: { hyperlink?: string };
}

/** @see https://developer.moneygram.com/moneygram-developer/docs/amend-api-overview */
export interface MoneyGramAmendReceiverNameRequest {
  name: MoneyGramName;
}

export interface MoneyGramErrorField {
  field: string;
}

export interface MoneyGramErrorResponse {
  errors: Array<{
    category: string;
    code: string;
    message: string;
    offendingFields?: MoneyGramErrorField[];
  }>;
}

/**
 * Webhook event delivered for the "TRANSACTION_STATUS_EVENT" subscription.
 * @see https://developer.moneygram.com/moneygram-developer/docs/transaction-event
 */
export interface MoneyGramTransactionStatusEvent {
  eventId: string;
  eventDate: string;
  subscriptionId: string;
  subscriptionType: 'TRANSACTION_STATUS_EVENT';
  eventPayload: {
    transactionId?: string;
    partnerTransactionId?: string[] | string;
    agentPartnerId: string;
    referenceNumber: string;
    transactionSendDate: string;
    transactionStatusDate: string;
    expectedPayoutDate: string;
    transactionStatus: MoneyGramTransactionStatus;
    transactionSubStatus?: MoneyGramTransactionSubStatus[];
  };
}

export interface MoneyGramRawEvents extends Record<string, any> {
  'moneygram.transaction_status_event': MoneyGramTransactionStatusEvent;
}
