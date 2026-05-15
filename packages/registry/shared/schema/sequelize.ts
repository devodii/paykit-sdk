import { DataTypes, Model, Sequelize } from 'sequelize';

// Initialize Sequelize (user will provide their connection)
export const initializeSequelize = (sequelize: Sequelize) => {
  // Customer Model
  class Customer extends Model {
    declare id: string;
    declare email: string;
    declare name: string;
    declare phone: string;
    declare metadata?: Record<string, any>;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  Customer.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'customers',
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ['email'] }],
    },
  );

  // Payment Model
  class Payment extends Model {
    declare id: string;
    declare amount: number;
    declare currency: string;
    declare status: string;
    declare itemId?: string;
    declare metadata: Record<string, any>;
    declare customerId?: string;
    declare customerEmail?: string;
    declare paymentUrl?: string;
    declare requiresAction?: boolean;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  Payment.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          'pending',
          'processing',
          'requires_action',
          'requires_capture',
          'succeeded',
          'canceled',
          'failed',
        ),
        allowNull: false,
      },
      itemId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'item_id',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'customer_id',
        references: {
          model: 'customers',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      customerEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'customer_email',
      },
      paymentUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'payment_url',
      },
      requiresAction: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        field: 'requires_action',
        defaultValue: false,
      },
    },
    {
      sequelize,
      tableName: 'payments',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['customer_id'] },
        { fields: ['status'] },
        { fields: ['customer_email'] },
      ],
    },
  );

  // Subscription Model
  class Subscription extends Model {
    declare id: string;
    declare amount: number;
    declare currency: string;
    declare status: string;
    declare itemId: string;
    declare billingInterval: string;
    declare currentPeriodStart: Date;
    declare currentPeriodEnd: Date;
    declare metadata?: Record<string, any>;
    declare customFields?: Record<string, any>;
    declare customerId?: string;
    declare customerEmail?: string;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  Subscription.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          'active',
          'past_due',
          'canceled',
          'expired',
          'trialing',
          'pending',
        ),
        allowNull: false,
      },
      itemId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'item_id',
      },
      billingInterval: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'billing_interval',
      },
      currentPeriodStart: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'current_period_start',
      },
      currentPeriodEnd: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'current_period_end',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      customFields: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'custom_fields',
      },
      customerId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'customer_id',
        references: {
          model: 'customers',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      customerEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'customer_email',
      },
    },
    {
      sequelize,
      tableName: 'subscriptions',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['customer_id'] },
        { fields: ['status'] },
        { fields: ['customer_email'] },
      ],
    },
  );

  // Refund Model
  class Refund extends Model {
    declare id: string;
    declare amount: number;
    declare currency: string;
    declare reason?: string;
    declare metadata?: Record<string, any>;
    declare paymentId: string;
    declare createdAt: Date;
  }

  Refund.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      paymentId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'payment_id',
        references: {
          model: 'payments',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    },
    {
      sequelize,
      tableName: 'refunds',
      timestamps: false,
      underscored: true,
      indexes: [{ fields: ['payment_id'] }],
    },
  );

  // Invoice Model
  class Invoice extends Model {
    declare id: string;
    declare subscriptionId?: string;
    declare billingMode: string;
    declare amountPaid: number;
    declare currency: string;
    declare status: string;
    declare paidAt?: Date;
    declare lineItems?: Record<string, any>;
    declare metadata?: Record<string, any>;
    declare customFields?: Record<string, any>;
    declare customerId?: string;
    declare customerEmail?: string;
    declare createdAt: Date;
    declare updatedAt: Date;
  }

  Invoice.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      subscriptionId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'subscription_id',
        references: {
          model: 'subscriptions',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      billingMode: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'billing_mode',
      },
      amountPaid: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'amount_paid',
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('paid', 'open'),
        allowNull: false,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'paid_at',
      },
      lineItems: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'line_items',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      customFields: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'custom_fields',
      },
      customerId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'customer_id',
        references: {
          model: 'customers',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      customerEmail: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'customer_email',
      },
    },
    {
      sequelize,
      tableName: 'invoices',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['customer_id'] },
        { fields: ['subscription_id'] },
        { fields: ['status'] },
        { fields: ['customer_email'] },
      ],
    },
  );

  // Define associations
  Customer.hasMany(Payment, {
    foreignKey: 'customerId',
    onDelete: 'CASCADE',
  });
  Payment.belongsTo(Customer, { foreignKey: 'customerId' });

  Customer.hasMany(Subscription, {
    foreignKey: 'customerId',
    onDelete: 'CASCADE',
  });
  Subscription.belongsTo(Customer, { foreignKey: 'customerId' });

  Payment.hasMany(Refund, {
    foreignKey: 'paymentId',
    onDelete: 'CASCADE',
  });
  Refund.belongsTo(Payment, { foreignKey: 'paymentId' });

  Customer.hasMany(Invoice, {
    foreignKey: 'customerId',
    onDelete: 'CASCADE',
  });
  Invoice.belongsTo(Customer, { foreignKey: 'customerId' });

  Subscription.hasMany(Invoice, {
    foreignKey: 'subscriptionId',
    onDelete: 'SET NULL',
  });
  Invoice.belongsTo(Subscription, { foreignKey: 'subscriptionId' });

  return {
    Customer,
    Payment,
    Subscription,
    Refund,
    Invoice,
  };
};

// Export types
export type CustomerModel = ReturnType<
  typeof initializeSequelize
>['Customer'];
export type PaymentModel = ReturnType<
  typeof initializeSequelize
>['Payment'];
export type SubscriptionModel = ReturnType<
  typeof initializeSequelize
>['Subscription'];
export type RefundModel = ReturnType<
  typeof initializeSequelize
>['Refund'];
export type InvoiceModel = ReturnType<
  typeof initializeSequelize
>['Invoice'];
