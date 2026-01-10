import { z } from 'zod';
import { schema } from '../tools';
import { OverrideProps } from '../types';
import { BillingInfo, billingSchema } from './billing';
import { metadataSchema } from './metadata';

export interface Customer {
  /**
   * The unique identifier of the customer.
   */
  id: string;

  /**
   * The email of the customer.
   */
  email: string;

  /**
   * The name of the customer.
   */
  name: string;

  /**
   * The phone number of the customer.
   */
  phone: string;

  /**
   * The metadata of the customer.
   */
  metadata?: Record<string, string>;

  /**
   * The custom fields of the customer for provider-specific or custom data.
   */
  custom_fields?: Record<string, unknown>;

  /**
   * The created timestamp of the customer.
   */
  created_at: Date;

  /**
   * The last updated timestamp of the customer.
   */
  updated_at: Date | null;
}

export const customerSchema = schema<Customer>()(
  z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    phone: z.string(),
    metadata: metadataSchema.optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
    created_at: z.date(),
    updated_at: z.date().nullable(),
  }),
);

type CustomerIdPayee = Customer['id'];

type EmailPayee = Pick<Customer, 'email'>;

export type Payee = CustomerIdPayee | EmailPayee;

export const payeeSchema = schema<Payee>()(
  z.union([z.string(), customerSchema.pick({ email: true })]),
);

export interface CreateCustomerParams
  extends OverrideProps<
    Pick<Customer, 'email' | 'name' | 'phone' | 'metadata'>,
    { name?: string; billing: BillingInfo | null }
  > {}

export const createCustomerSchema = schema<CreateCustomerParams>()(
  z.object({
    email: z.string().email(),
    name: z.string().optional(),
    phone: z.string(),
    metadata: metadataSchema.optional(),
    billing: billingSchema.nullable(),
  }),
);

export interface UpdateCustomerParams
  extends Partial<Pick<Customer, 'email' | 'name' | 'phone' | 'metadata'>> {
  provider_metadata?: Record<string, unknown>;
  billing?: BillingInfo | null;
}

export const updateCustomerSchema = schema<UpdateCustomerParams>()(
  z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
    metadata: metadataSchema.optional(),
    provider_metadata: z.record(z.string(), z.unknown()).optional(),
  }),
);

export interface RetrieveCustomerParams {
  /**
   * The unique identifier of the customer.
   */
  id: string;
}

export const retrieveCustomerSchema = schema<RetrieveCustomerParams>()(
  z.object({
    id: z.string(),
  }),
);

export const isEmailCustomer = (customer: unknown): customer is EmailPayee => {
  return typeof customer === 'object' && customer !== null && 'email' in customer;
};

export const isIdCustomer = (customer: unknown): customer is CustomerIdPayee => {
  return typeof customer === 'string' && customer.length > 0;
};
