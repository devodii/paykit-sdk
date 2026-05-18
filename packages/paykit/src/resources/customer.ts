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
  phone: string | null;

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
    phone: z.string().nullable(),
    metadata: metadataSchema.optional(),
    custom_fields: z.record(z.string(), z.unknown()).optional(),
    created_at: z.date(),
    updated_at: z.date().nullable(),
  }),
);

type EmailPayee = { email: string };

type IdPayee = { id: string | number };

export type Payee = EmailPayee | IdPayee;

export const payeeSchema = schema<Payee>()(
  z.union([
    z.object({ email: z.string().email() }),
    z.object({ id: z.union([z.string(), z.number()]) }),
  ]),
);

export interface CreateCustomerParams<
  TProviderMetadata = Record<string, unknown>,
> extends OverrideProps<
    Pick<Customer, 'email' | 'name' | 'phone' | 'metadata'>,
    {
      name?: string;
      phone?: string | null;
      billing: BillingInfo | null;
      provider_metadata?: TProviderMetadata;
    }
  > {}

export interface CreateCustomerParams1
  extends OverrideProps<
    Pick<Customer, 'email' | 'name' | 'phone' | 'metadata'>,
    { name?: string; phone?: string | null; billing: BillingInfo | null }
  > {}

export const createCustomerSchema = schema<CreateCustomerParams>()(
  z.object({
    email: z.string().email(),
    name: z.string().optional(),
    phone: z.string().nullable().optional(),
    metadata: metadataSchema.optional(),
    billing: billingSchema.nullable(),
    provider_metadata: z.record(z.string(), z.unknown()).optional(),
  }),
);

export interface UpdateCustomerParams<
  TProviderMetadata = Record<string, unknown>,
> extends Partial<
    Pick<Customer, 'email' | 'name' | 'phone' | 'metadata'>
  > {
  provider_metadata?: TProviderMetadata;
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

export const retrieveCustomerSchema =
  schema<RetrieveCustomerParams>()(
    z.object({
      id: z.string(),
    }),
  );

export const isEmailCustomer = (
  customer: unknown,
): customer is EmailPayee => {
  return (
    typeof customer === 'object' &&
    customer !== null &&
    'email' in customer
  );
};

export const isIdCustomer = (
  customer: unknown,
): customer is IdPayee => {
  return (
    typeof customer === 'object' &&
    customer !== null &&
    'id' in customer
  );
};

export const parseCustomerName = (params: {
  name?: string;
  email: string;
}) => {
  const full = params.name?.trim() || params.email.split('@')[0];

  const parts = full.split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ') || '';

  return {
    fullName: full,
    firstName: first,
    lastName: last,
    initials: `${first[0] || ''}${last[0] || ''}`.toUpperCase(),
  };
};
