import {
    Entity,
    PrimaryColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
  } from 'typeorm';
  
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
  
  // Entities
  @Entity('customers')
  export class Customer {
    @PrimaryColumn({ type: 'text' })
    id!: string;
  
  @Column({ type: 'text', unique: true })
  @Index()
  email!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  phone!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
  
  @Entity('payments')
  export class Payment {
    @PrimaryColumn({ type: 'text' })
    id!: string;
  
    @Column({ type: 'integer' })
    amount!: number;
  
    @Column({ type: 'text' })
    currency!: string;
  
    @Column({
      type: 'enum',
      enum: PaymentStatus,
    })
    @Index()
    status!: PaymentStatus;
  
    @Column({ type: 'text', nullable: true, name: 'item_id' })
    itemId?: string;
  
    @Column({ type: 'jsonb' })
    metadata!: Record<string, any>;
  
    @Column({ type: 'text', nullable: true, name: 'customer_id' })
    @Index()
    customerId?: string;
  
    @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customer_id' })
    customer?: Customer;
  
    @Column({ type: 'text', nullable: true, name: 'customer_email' })
    @Index()
    customerEmail?: string;
  
    @Column({ type: 'text', nullable: true, name: 'payment_url' })
    paymentUrl?: string;

    @Column({ type: 'boolean', nullable: true, name: 'requires_action' })
    requiresAction?: boolean;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;
  
    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updatedAt!: Date;
  }
  
 @Entity('subscriptions')
 export class Subscription {
  @PrimaryColumn({ type: 'text' })
  id!: string;
  
    @Column({ type: 'integer' })
    amount!: number;
  
    @Column({ type: 'text' })
    currency!: string;
  
    @Column({
      type: 'enum',
      enum: SubscriptionStatus,
    })
    @Index()
    status!: SubscriptionStatus;
  
    @Column({ type: 'text', name: 'item_id' })
    itemId!: string;
  
    @Column({ type: 'text', name: 'billing_interval' })
    billingInterval!: string;
  
    @Column({ type: 'timestamp', name: 'current_period_start' })
    currentPeriodStart!: Date;
  
    @Column({ type: 'timestamp', name: 'current_period_end' })
    currentPeriodEnd!: Date;
  
    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, any>;
  
    @Column({ type: 'jsonb', nullable: true, name: 'custom_fields' })
    customFields?: Record<string, any>;
  
    @Column({ type: 'text', nullable: true, name: 'customer_id' })
    @Index()
    customerId?: string;
  
    @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customer_id' })
    customer?: Customer;
  
    @Column({ type: 'text', nullable: true, name: 'customer_email' })
    @Index()
    customerEmail?: string;
  
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt!: Date;
}
  
  @Entity('refunds')
  export class Refund {
    @PrimaryColumn({ type: 'text' })
    id!: string;
  
    @Column({ type: 'integer' })
    amount!: number;
  
    @Column({ type: 'text' })
    currency!: string;
  
    @Column({ type: 'text', nullable: true })
    reason?: string;
  
    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, any>;
  
    @Column({ type: 'text', name: 'payment_id' })
    @Index()
    paymentId!: string;
  
    @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'payment_id' })
    payment!: Payment;
  
    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;
  }
  
  @Entity('invoices')
  export class Invoice {
    @PrimaryColumn({ type: 'text' })
    id!: string;
  
    @Column({ type: 'text', nullable: true, name: 'subscription_id' })
    @Index()
    subscriptionId?: string;
  
    @ManyToOne(() => Subscription, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'subscription_id' })
    subscription?: Subscription;
  
    @Column({ type: 'text', name: 'billing_mode' })
    billingMode!: string;
  
  @Column({ type: 'integer', name: 'amount_paid' })
  amountPaid!: number;

  @Column({ type: 'text' })
  currency!: string;
  
    @Column({
      type: 'enum',
      enum: InvoiceStatus,
    })
    @Index()
    status!: InvoiceStatus;
  
    @Column({ type: 'timestamp', nullable: true, name: 'paid_at' })
    paidAt?: Date;
  
    @Column({ type: 'jsonb', nullable: true, name: 'line_items' })
    lineItems?: Record<string, any>;
  
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'custom_fields' })
  customFields?: Record<string, any>;
  
    @Column({ type: 'text', nullable: true, name: 'customer_id' })
    @Index()
    customerId?: string;
  
    @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customer_id' })
    customer?: Customer;
  
    @Column({ type: 'text', nullable: true, name: 'customer_email' })
    @Index()
    customerEmail?: string;
  
    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;
  
    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updatedAt!: Date;
  }