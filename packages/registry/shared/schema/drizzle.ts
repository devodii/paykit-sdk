import {
  pgTable,
  text,
  timestamp,
  integer,
  json,
  pgEnum,
  index,
  boolean,
} from 'drizzle-orm/pg-core';

// Enums
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'requires_action',
  'requires_capture',
  'succeeded',
  'canceled',
  'failed',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'canceled',
  'expired',
  'trialing',
  'pending',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'paid',
  'open',
]);

// Tables
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    status: paymentStatusEnum('status').notNull(),
    itemId: text('item_id'),
    metadata: json('metadata').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),

    // Optional customer relationship
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'cascade',
    }),

    // Guest checkout for when the customer is not yet determined
    customerEmail: text('customer_email'),

    paymentUrl: text('payment_url'),
    requiresAction: boolean('requires_action').default(false),
  },
  table => ({
    customerIdIdx: index('payments_customer_id_idx').on(
      table.customerId,
    ),
    statusIdx: index('payments_status_idx').on(table.status),
    customerEmailIdx: index('payments_customer_email_idx').on(
      table.customerEmail,
    ),
  }),
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    itemId: text('item_id').notNull(),
    billingInterval: text('billing_interval').notNull(),
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    metadata: json('metadata'),
    customFields: json('custom_fields'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),

    // Optional customer relationship
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'cascade',
    }),

    // Guest checkout for when the customer is not yet determined
    customerEmail: text('customer_email'),
  },
  table => ({
    customerIdIdx: index('subscriptions_customer_id_idx').on(
      table.customerId,
    ),
    statusIdx: index('subscriptions_status_idx').on(table.status),
    customerEmailIdx: index('subscriptions_customer_email_idx').on(
      table.customerEmail,
    ),
  }),
);

export const refunds = pgTable(
  'refunds',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    reason: text('reason'),
    metadata: json('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),

    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
  },
  table => ({
    paymentIdIdx: index('refunds_payment_id_idx').on(table.paymentId),
  }),
);

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    subscriptionId: text('subscription_id').references(
      () => subscriptions.id,
      {
        onDelete: 'set null',
      },
    ),
    billingMode: text('billing_mode').notNull(),
    amountPaid: integer('amount_paid').notNull(),
    currency: text('currency').notNull(),
    status: invoiceStatusEnum('status').notNull(),
    paidAt: timestamp('paid_at'),
    lineItems: json('line_items'),
    metadata: json('metadata'),
    customFields: json('custom_fields'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),

    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'cascade',
    }),

    // Guest checkout for when the customer is not yet determined
    customerEmail: text('customer_email'),
  },
  table => ({
    customerIdIdx: index('invoices_customer_id_idx').on(
      table.customerId,
    ),
    subscriptionIdIdx: index('invoices_subscription_id_idx').on(
      table.subscriptionId,
    ),
    statusIdx: index('invoices_status_idx').on(table.status),
    customerEmailIdx: index('invoices_customer_email_idx').on(
      table.customerEmail,
    ),
  }),
);

export type Invoice = typeof invoices.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
