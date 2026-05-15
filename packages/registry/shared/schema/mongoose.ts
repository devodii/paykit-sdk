import { Schema, model, Document, Types } from 'mongoose';

// Enums
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  REQUIRES_ACTION = 'requires_action',
  REQUIRES_CAPTURE = 'requires_capture',
  SUCCEEDED = 'succeeded',
  CANCELED = 'canceled',
  FAILED = 'failed',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  TRIALING = 'trialing',
  PENDING = 'pending',
}

export enum InvoiceStatus {
  PAID = 'paid',
  OPEN = 'open',
}

// Interfaces
export interface ICustomer extends Document {
  _id: string;
  email: string;
  name: string;
  phone: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment extends Document {
  _id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  itemId?: string;
  metadata: Record<string, any>;
  customerId?: Types.ObjectId | ICustomer;
  customerEmail?: string;
  paymentUrl?: string;
  requiresAction?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscription extends Document {
  _id: string;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  itemId: string;
  billingInterval: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  metadata?: Record<string, any>;
  customFields?: Record<string, any>;
  customerId?: Types.ObjectId | ICustomer;
  customerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRefund extends Document {
  _id: string;
  amount: number;
  currency: string;
  reason?: string;
  metadata?: Record<string, any>;
  paymentId: Types.ObjectId | IPayment;
  createdAt: Date;
}

export interface IInvoice extends Document {
  _id: string;
  subscriptionId?: Types.ObjectId | ISubscription;
  billingMode: string;
  amountPaid: number;
  currency: string;
  status: InvoiceStatus;
  paidAt?: Date;
  lineItems?: Record<string, any>;
  metadata?: Record<string, any>;
  customFields?: Record<string, any>;
  customerId?: Types.ObjectId | ICustomer;
  customerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Schemas
const CustomerSchema = new Schema<ICustomer>(
  {
    _id: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    _id: false,
  },
);

const PaymentSchema = new Schema<IPayment>(
  {
    _id: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true,
      index: true,
    },
    itemId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed, required: true },
    customerId: { type: String, ref: 'Customer', index: true },
    customerEmail: { type: String, index: true },
    paymentUrl: { type: String },
    requiresAction: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    _id: false,
  },
);

const SubscriptionSchema = new Schema<ISubscription>(
  {
    _id: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      required: true,
      index: true,
    },
    itemId: { type: String, required: true },
    billingInterval: { type: String, required: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed },
    customFields: { type: Schema.Types.Mixed },
    customerId: { type: String, ref: 'Customer', index: true },
    customerEmail: { type: String, index: true },
  },
  {
    timestamps: true,
    _id: false,
  },
);

const RefundSchema = new Schema<IRefund>(
  {
    _id: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed },
    paymentId: {
      type: String,
      ref: 'Payment',
      required: true,
      index: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    _id: false,
  },
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    _id: { type: String, required: true },
    subscriptionId: {
      type: String,
      ref: 'Subscription',
      index: true,
    },
    billingMode: { type: String, required: true },
    amountPaid: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      required: true,
      index: true,
    },
    paidAt: { type: Date },
    lineItems: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    customFields: { type: Schema.Types.Mixed },
    customerId: { type: String, ref: 'Customer', index: true },
    customerEmail: { type: String, index: true },
  },
  {
    timestamps: true,
    _id: false,
  },
);

// Models
export const Customer = model<ICustomer>('Customer', CustomerSchema);
export const Payment = model<IPayment>('Payment', PaymentSchema);
export const Subscription = model<ISubscription>(
  'Subscription',
  SubscriptionSchema,
);
export const Refund = model<IRefund>('Refund', RefundSchema);
export const Invoice = model<IInvoice>('Invoice', InvoiceSchema);
